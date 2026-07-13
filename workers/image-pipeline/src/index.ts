import { processImage } from "./processor";
import { sendPipelineCallback } from "./callback";
import type { PipelineEnv, R2ObjectEvent } from "./types";

/**
 * Queue consumer for original image uploads.
 *
 * Only `ingest/` objects are source uploads. Generated files are written under
 * `assets/`, so their R2 events are acknowledged without reprocessing and
 * cannot create a derivative-processing loop.
 */

/**
 * Application-level processing budget.
 *
 * On this delivery's third processing failure, the Worker sends the API a
 * terminal `failed` callback and acknowledges the message instead of leaving
 * the upload indefinitely in `processing`. This is intentionally lower than
 * the Queue consumer's `max_retries`, which leaves delivery capacity if that
 * terminal callback cannot reach the API.
 */
const MAX_PROCESSING_ATTEMPTS = 3;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export default {
	/** Consumes R2 source-upload events and reports their lifecycle to the API. */
	async queue(
		batch: MessageBatch<R2ObjectEvent>,
		env: PipelineEnv,
	): Promise<void> {
		for (const message of batch.messages) {
			const event = message.body;
			const objectKey = event.object?.key;
			const originalEtag = event.object?.eTag;

			if (!objectKey?.startsWith("ingest/") || !originalEtag) {
				console.log(
					JSON.stringify({
						event: "image_pipeline.ignored",
						objectKey,
						reason: "outside_ingest_namespace",
					}),
				);
				message.ack();
				continue;
			}

			try {
				await sendPipelineCallback(env, {
					status: "processing",
					originalObjectKey: objectKey,
					originalEtag,
				});

				if ((event.object.size ?? 0) > MAX_SOURCE_BYTES) {
					throw new Error("Source image exceeds the 20 MiB processing limit");
				}

				const source = await env.ASKA_BUCKET.get(objectKey);
				if (!source) throw new Error("Original object no longer exists");

				const result = await processImage(
					new Uint8Array(await source.arrayBuffer()),
				);
				const variants = await Promise.all(
					result.variants.map(async (variant) => {
						const objectKey = makeVariantObjectKey(
							storageIdFromOriginalKey(event.object.key),
							variant.role,
						);
						await env.ASKA_BUCKET.put(objectKey, variant.bytes, {
							httpMetadata: { contentType: variant.contentType },
						});
						return {
							role: variant.role,
							objectKey,
							width: variant.width,
							height: variant.height,
							contentType: variant.contentType,
							sizeBytes: variant.sizeBytes,
						};
					}),
				);

				await sendPipelineCallback(env, {
					status: "completed",
					originalObjectKey: objectKey,
					originalEtag,
					width: result.width,
					height: result.height,
					format: result.format,
					blurDataURL: result.blurDataURL,
					extractionVersion: result.extractionVersion,
					palette: result.palette,
					variants,
				});

				console.log(
					JSON.stringify({
						event: "image_pipeline.completed",
						objectKey,
						variants: variants.length,
						palette: result.palette.length,
					}),
				);
				message.ack();
			} catch (error) {
				const messageText =
					error instanceof Error
						? error.message
						: "Unknown image processing error";
				console.error(
					JSON.stringify({
						event: "image_pipeline.failed",
						objectKey,
						attempts: message.attempts,
						error: messageText,
					}),
				);

				if (message.attempts >= MAX_PROCESSING_ATTEMPTS) {
					try {
						await sendPipelineCallback(env, {
							status: "failed",
							originalObjectKey: objectKey,
							originalEtag,
							error: messageText.slice(0, 1000),
						});

						message.ack();
					} catch (callbackError) {
						console.error(
							JSON.stringify({
								event: "image_pipeline.failure_callback_failed",
								objectKey,
								error: String(callbackError),
							}),
						);
						message.retry({ delaySeconds: 30 });
					}
				} else {
					message.retry({ delaySeconds: retryDelay(message.attempts) });
				}
			}
		}
	},
} satisfies ExportedHandler<PipelineEnv, R2ObjectEvent>;

/** Extracts the storage identifier from a validated original-upload key. */
function storageIdFromOriginalKey(objectKey: string): string {
	const match = /^ingest\/([^/]+)\/original(?:\.[a-z0-9]+)?$/i.exec(objectKey);

	if (!match) throw new Error("Invalid ingest object key");
	return match[1]!;
}

/** Places generated variants outside the source-event namespace. */
function makeVariantObjectKey(
	storageId: string,
	role: "display" | "preview",
): string {
	return `assets/${storageId}/${role}.webp`;
}

/** Returns capped exponential backoff in seconds for a retry attempt. */
function retryDelay(attempt: number): number {
	return Math.min(60, 5 * 2 ** Math.max(0, attempt - 1));
}
