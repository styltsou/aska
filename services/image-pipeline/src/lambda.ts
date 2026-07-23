import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { SQSBatchResponse, SQSHandler, S3Event } from "aws-lambda";
import { createHmac } from "node:crypto";

import { processImage } from "./processor";

const MAX_PROCESSING_ATTEMPTS = 3;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const client = new S3Client({});

type PipelineVariant = {
  role: "display" | "preview";
  objectKey: string;
  width: number;
  height: number;
  contentType: "image/webp";
  sizeBytes: number;
};

type PipelineCallback =
  | {
      status: "processing";
      originalObjectKey: string;
      originalEtag: string;
    }
  | {
      status: "completed";
      originalObjectKey: string;
      originalEtag: string;
      width: number;
      height: number;
      format: string;
      blurDataURL: string;
      extractionVersion: number;
      palette: unknown[];
      variants: PipelineVariant[];
    }
  | {
      status: "failed";
      originalObjectKey: string;
      originalEtag: string;
      error: string;
    };

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const decodeS3Key = (key: string) =>
  decodeURIComponent(key.replace(/\+/g, " "));

export const handler: SQSHandler = async (event): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const message of event.Records) {
    try {
      const s3Event = JSON.parse(message.body) as S3Event;
      for (const record of s3Event.Records) {
        await processRecord(
          record.s3.bucket.name,
          decodeS3Key(record.s3.object.key),
          record.s3.object.eTag,
          record.s3.object.size,
        );
      }
    } catch (error) {
      const attempts = Number(
        message.attributes.ApproximateReceiveCount ?? "1",
      );
      const detail =
        error instanceof Error
          ? error.message
          : "Unknown image processing error";
      console.error(
        JSON.stringify({
          event: "image_pipeline.failed",
          messageId: message.messageId,
          attempts,
          error: detail,
        }),
      );

      // The third processing failure is terminal. We notify the API, then
      // acknowledge the message. A failed callback remains retryable.
      if (attempts >= MAX_PROCESSING_ATTEMPTS) {
        try {
          const s3Event = JSON.parse(message.body) as S3Event;
          for (const record of s3Event.Records) {
            await sendCallback({
              status: "failed",
              originalObjectKey: decodeS3Key(record.s3.object.key),
              originalEtag: record.s3.object.eTag,
              error: detail.slice(0, 1000),
            });
          }
        } catch (callbackError) {
          console.error(
            JSON.stringify({
              event: "image_pipeline.failure_callback_failed",
              messageId: message.messageId,
              error: String(callbackError),
            }),
          );
          batchItemFailures.push({ itemIdentifier: message.messageId });
        }
      } else {
        batchItemFailures.push({ itemIdentifier: message.messageId });
      }
    }
  }

  return { batchItemFailures };
};

async function processRecord(
  bucket: string,
  objectKey: string,
  originalEtag: string,
  size?: number,
) {
  if (!objectKey.startsWith("ingest/") || !originalEtag) return;
  if ((size ?? 0) > MAX_SOURCE_BYTES)
    throw new Error("Source image exceeds the 20 MiB processing limit");

  await sendCallback({
    status: "processing",
    originalObjectKey: objectKey,
    originalEtag,
  });
  const source = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
  );
  if (!source.Body) throw new Error("Original object no longer exists");

  const result = await processImage(await source.Body.transformToByteArray());
  const storageId = storageIdFromOriginalKey(objectKey);
  const variants = await Promise.all(
    result.variants.map(async (variant) => {
      const key = `assets/${storageId}/${variant.role}.webp`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: variant.bytes,
          ContentType: variant.contentType,
        }),
      );
      return {
        role: variant.role,
        objectKey: key,
        width: variant.width,
        height: variant.height,
        contentType: variant.contentType,
        sizeBytes: variant.sizeBytes,
      };
    }),
  );

  await sendCallback({
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
}

async function sendCallback(payload: PipelineCallback) {
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = createHmac(
    "sha256",
    required("IMAGE_PIPELINE_CALLBACK_SECRET"),
  )
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const response = await fetch(
    new URL(
      "/api/v1/internal/image-pipeline/callback",
      required("PIPELINE_API_BASE_URL"),
    ),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-aska-timestamp": timestamp,
        "x-aska-signature": signature,
      },
      body,
    },
  );
  if (!response.ok)
    throw new Error(`Pipeline callback failed with status ${response.status}`);
}

function storageIdFromOriginalKey(objectKey: string): string {
  const match = /^ingest\/([^/]+)\/original(?:\.[a-z0-9]+)?$/i.exec(objectKey);
  if (!match) throw new Error("Invalid ingest object key");
  return match[1]!;
}
