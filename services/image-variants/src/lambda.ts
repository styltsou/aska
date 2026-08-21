import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { initializeSentry, log } from "../../image-shared/src/observability";
import { callPipeline } from "../../image-shared/src/pipeline-client";
import {
  imageIdentityFromOriginalKey,
  sendCallback,
} from "../../image-shared/src/pipeline-callback";
import {
  sourceImagesFromSqsBody,
  type SourceImage,
} from "../../image-shared/src/sqs-handler";
import { parseResourceMediaRenditionJob } from "../../image-shared/src/variant-job";
import { createTaskHandler } from "../../image-shared/src/task-handler";
import {
  SafeFetchError,
  safeFetch,
} from "../../url-unfurl-shared/src/safe-fetch";
import { processImageVariants } from "./processor";

initializeSentry("image-variants");

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const client = new S3Client({});

type VariantsJob =
  | { kind: "upload"; sources: SourceImage[] }
  | { kind: "resource-media"; mediaId: number; generation: number };

type ResourceMediaClaim =
  | { ignored: true }
  | {
      ignored: false;
      mediaId: number;
      generation: number;
      url: string;
      organizationId: string;
      storageId: string;
      role: "preview" | "icon" | "primary" | "cover";
      processingProfile: "link-preview-v1" | "icon-v1";
    };

function parseJob(body: string): VariantsJob {
  const parsed = parseResourceMediaRenditionJob(JSON.parse(body));
  if (!parsed)
    return { kind: "upload", sources: sourceImagesFromSqsBody(body) };
  return {
    kind: "resource-media",
    mediaId: parsed.mediaId as number,
    generation: parsed.generation as number,
  };
}

async function processJob(job: VariantsJob): Promise<void> {
  if (job.kind === "resource-media") return processResourceMedia(job);
  for (const source of job.sources) await processUpload(source);
}

async function processUpload(source: SourceImage): Promise<void> {
  if ((source.size ?? 0) > MAX_SOURCE_BYTES)
    throw new Error("Source image exceeds the 20 MiB processing limit");

  await sendCallback({
    event: "image.processing.started",
    originalObjectKey: source.objectKey,
    originalEtag: source.originalEtag,
  });
  const original = await client.send(
    new GetObjectCommand({ Bucket: source.bucket, Key: source.objectKey }),
  );
  if (!original.Body) throw new Error("Original object no longer exists");

  const bytes = await original.Body.transformToByteArray();
  const result = await processImageVariants(bytes, "upload-v1");
  const { workspaceId, storageId } = imageIdentityFromOriginalKey(
    source.objectKey,
  );
  const uploadVariants = result.variants.filter(
    (variant): variant is typeof variant & { role: "display" | "preview" } =>
      variant.role !== "master",
  );
  if (uploadVariants.length !== result.variants.length)
    throw new Error("Upload profile produced an unexpected master variant");
  const variants = await Promise.all(
    uploadVariants.map(async (variant) => {
      const objectKey = `${workspaceId}/${storageId}/${variant.role}.webp`;
      await putVariant(source.bucket, objectKey, variant.bytes);
      return { ...variant, objectKey };
    }),
  );

  await sendCallback({
    event: "image.variants.completed",
    originalObjectKey: source.objectKey,
    originalEtag: source.originalEtag,
    width: result.width,
    height: result.height,
    format: result.format,
    blurDataURL: result.blurDataURL!,
    variants,
  });
  log("info", "image variants completed", {
    event: "image_variants.completed",
    objectKey: source.objectKey,
    variants: variants.length,
  });
}

async function processResourceMedia(
  job: Extract<VariantsJob, { kind: "resource-media" }>,
): Promise<void> {
  const claim = await callPipeline<ResourceMediaClaim>(
    "/api/v1/internal/resource-media/claim",
    { id: job.mediaId, generation: job.generation },
  );
  if (claim.ignored) return;
  const fetched = await safeFetch(claim.url, {
    accept:
      "image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon,image/vnd.microsoft.icon",
    allowedContentTypes: [
      "image/avif",
      "image/webp",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ],
    maxBytes: MAX_SOURCE_BYTES,
    totalTimeoutMs: 15_000,
  });
  const result = await processImageVariants(
    fetched.body,
    claim.processingProfile,
  );
  const bucket = required("S3_BUCKET");
  const stored = await Promise.all(
    result.variants.map(async (variant) => {
      const objectKey = `${claim.organizationId}/${claim.storageId}/${variant.role}.webp`;
      await putVariant(bucket, objectKey, variant.bytes);
      return [
        variant.role,
        {
          objectKey,
          width: variant.width,
          height: variant.height,
          contentType: variant.contentType,
          sizeBytes: variant.sizeBytes,
        },
      ] as const;
    }),
  );
  await callPipeline("/api/v1/internal/resource-media/result", {
    event: "resource.media.completed",
    id: job.mediaId,
    generation: job.generation,
    width: result.width,
    height: result.height,
    format: result.format,
    sizeBytes: result.sizeBytes,
    blurDataURL: result.blurDataURL,
    variants: Object.fromEntries(stored),
  });
}

async function reportFailure(job: VariantsJob, error: unknown): Promise<void> {
  if (job.kind === "upload") {
    const detail =
      error instanceof Error ? error.message : "Unknown image processing error";
    for (const source of job.sources) {
      await sendCallback({
        event: "image.variants.failed",
        originalObjectKey: source.objectKey,
        originalEtag: source.originalEtag,
        error: detail.slice(0, 1_000),
      });
    }
    return;
  }

  const safe = error instanceof SafeFetchError ? error : undefined;
  await callPipeline("/api/v1/internal/resource-media/result", {
    event: "resource.media.failed",
    id: job.mediaId,
    generation: job.generation,
    failureCategory: safe?.category ?? "image_processing",
    diagnosticCode:
      safe?.category ??
      (error instanceof Error
        ? error.message.slice(0, 120)
        : "unexpected_media_error"),
  });
}

async function putVariant(
  bucket: string,
  objectKey: string,
  bytes: Uint8Array,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const handler = createTaskHandler({
  pipeline: "image-variants",
  parse: parseJob,
  process: processJob,
  reportTerminalFailure: reportFailure,
});
