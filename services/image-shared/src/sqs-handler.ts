import type { SQSBatchResponse, SQSHandler, S3Event } from "aws-lambda";

const MAX_PROCESSING_ATTEMPTS = 5;

export type SourceImage = {
  bucket: string;
  objectKey: string;
  originalEtag: string;
  size?: number;
};

type HandlerOptions = {
  pipeline: "variants" | "palette";
  process: (source: SourceImage) => Promise<void>;
  reportTerminalFailure: (source: SourceImage, error: string) => Promise<void>;
};

const decodeS3Key = (key: string) =>
  decodeURIComponent(key.replace(/\+/g, " "));

function parseS3Event(body: string): S3Event {
  const notification = JSON.parse(body) as { Message?: unknown };
  // SNS wraps the S3 notification before delivering it to each SQS subscriber.
  // Keep accepting a raw S3 body as well so local event fixtures remain useful.
  return typeof notification.Message === "string"
    ? (JSON.parse(notification.Message) as S3Event)
    : (notification as S3Event);
}

function sourcesFromS3Event(event: S3Event): SourceImage[] {
  // S3 sends an initial test notification without Records when a destination is
  // configured. It is not an image-processing job.
  if (!Array.isArray(event.Records)) return [];
  return event.Records.flatMap((record) => {
    const source = {
      bucket: record.s3.bucket.name,
      objectKey: decodeS3Key(record.s3.object.key),
      originalEtag: record.s3.object.eTag,
      size: record.s3.object.size,
    };
    return source.objectKey.startsWith("ingest/") && source.originalEtag
      ? [source]
      : [];
  });
}

/**
 * Wraps an independent image processor in the shared SQS retry contract.
 *
 * A failed job is redelivered until its fifth receive. At that point the API
 * receives the matching terminal status. If that terminal callback is down,
 * the message remains failed so SQS can redeliver it and ultimately retain it
 * in the queue's DLQ.
 */
export function createSqsHandler({
  pipeline,
  process,
  reportTerminalFailure,
}: HandlerOptions): SQSHandler {
  return async (event): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

    for (const message of event.Records) {
      const attempts = Number(
        message.attributes.ApproximateReceiveCount ?? "1",
      );
      if (attempts > MAX_PROCESSING_ATTEMPTS) {
        try {
          const s3Event = parseS3Event(message.body);
          for (const source of sourcesFromS3Event(s3Event)) {
            await reportTerminalFailure(
              source,
              "Image processing failed before its terminal callback could be delivered",
            );
          }
        } catch (callbackError) {
          console.error(
            JSON.stringify({
              event: `image_${pipeline}.failure_callback_failed`,
              messageId: message.messageId,
              attempts,
              error: String(callbackError),
            }),
          );
          batchItemFailures.push({ itemIdentifier: message.messageId });
        }
        continue;
      }

      try {
        const s3Event = parseS3Event(message.body);
        for (const source of sourcesFromS3Event(s3Event)) await process(source);
      } catch (error) {
        const detail =
          error instanceof Error
            ? error.message
            : "Unknown image processing error";
        console.error(
          JSON.stringify({
            event: `image_${pipeline}.failed`,
            messageId: message.messageId,
            attempts,
            error: detail,
          }),
        );

        if (attempts < MAX_PROCESSING_ATTEMPTS) {
          batchItemFailures.push({ itemIdentifier: message.messageId });
          continue;
        }

        try {
          const s3Event = parseS3Event(message.body);
          for (const source of sourcesFromS3Event(s3Event)) {
            await reportTerminalFailure(source, detail.slice(0, 1000));
          }
        } catch (callbackError) {
          console.error(
            JSON.stringify({
              event: `image_${pipeline}.failure_callback_failed`,
              messageId: message.messageId,
              error: String(callbackError),
            }),
          );
          batchItemFailures.push({ itemIdentifier: message.messageId });
        }
      }
    }

    return { batchItemFailures };
  };
}
