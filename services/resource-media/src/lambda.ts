import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { initializeSentry } from "../../image-shared/src/observability";
import { callPipeline } from "../../url-unfurl-shared/src/pipeline-client";
import {
  SafeFetchError,
  safeFetch,
} from "../../url-unfurl-shared/src/safe-fetch";
import { createTaskHandler } from "../../url-unfurl-shared/src/task-handler";
import { processResourceImage } from "./processor";

initializeSentry("resource-media");

type Task = { mediaId: number; generation: number };
type Claim =
  | { ignored: true }
  | {
      ignored: false;
      mediaId: number;
      generation: number;
      url: string;
      organizationId: string;
      storageId: string;
      role: "preview" | "icon" | "primary" | "cover";
      processingProfile: string;
    };

const client = new S3Client({});

function parseTask(body: string): Task {
  const parsed = JSON.parse(body) as Partial<Task>;
  if (
    !Number.isSafeInteger(parsed.mediaId) ||
    !Number.isSafeInteger(parsed.generation)
  )
    throw new Error("Invalid resource media task");
  return { mediaId: parsed.mediaId!, generation: parsed.generation! };
}

async function processTask(task: Task) {
  const claim = await callPipeline<Claim>(
    "/api/v1/internal/resource-media/claim",
    { id: task.mediaId, generation: task.generation },
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
    maxBytes: 20 * 1024 * 1024,
    totalTimeoutMs: 15_000,
  });
  const processed = await processResourceImage(
    fetched.body,
    claim.processingProfile,
  );
  const bucket = required("S3_BUCKET");
  const stored = await Promise.all(
    processed.variants.map(async (variant) => {
      const objectKey = `${claim.organizationId}/${claim.storageId}/${variant.role}.webp`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: variant.bytes,
          ContentType: variant.contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
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
    id: task.mediaId,
    generation: task.generation,
    width: processed.width,
    height: processed.height,
    format: processed.format,
    sizeBytes: processed.sizeBytes,
    blurDataURL: processed.blurDataURL,
    variants: Object.fromEntries(stored),
  });
}

async function reportFailure(task: Task, error: unknown) {
  const safe = error instanceof SafeFetchError ? error : undefined;
  await callPipeline("/api/v1/internal/resource-media/result", {
    event: "resource.media.failed",
    id: task.mediaId,
    generation: task.generation,
    failureCategory: safe?.category ?? "image_processing",
    diagnosticCode:
      safe?.category ??
      (error instanceof Error
        ? error.message.slice(0, 120)
        : "unexpected_media_error"),
  });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const handler = createTaskHandler({
  pipeline: "resource-media",
  parse: parseTask,
  process: processTask,
  reportTerminalFailure: reportFailure,
});
