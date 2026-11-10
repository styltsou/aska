import type { S3Event, SQSHandler } from "aws-lambda";

import { isOriginalImageObjectKey } from "./pipeline-callback";
import { createTaskHandler } from "./task-handler";

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
    return isOriginalImageObjectKey(source.objectKey) && source.originalEtag
      ? [source]
      : [];
  });
}

/** Normalizes either a raw S3 event or its SNS envelope at the queue boundary. */
export function sourceImagesFromSqsBody(body: string): SourceImage[] {
  return sourcesFromS3Event(parseS3Event(body));
}

/** Adapts upload events to the shared task retry and terminal-result contract. */
export function createSqsHandler({
  pipeline,
  process,
  reportTerminalFailure,
}: HandlerOptions): SQSHandler {
  return createTaskHandler({
    pipeline: `image-${pipeline}`,
    parse: sourceImagesFromSqsBody,
    process: async (sources) => {
      for (const source of sources) await process(source);
    },
    reportTerminalFailure: async (sources, error) => {
      const detail =
        error instanceof Error
          ? error.message ===
            "Task failed before its terminal callback could be delivered"
            ? "Image processing failed before its terminal callback could be delivered"
            : error.message
          : "Unknown image processing error";
      for (const source of sources)
        await reportTerminalFailure(source, detail.slice(0, 1_000));
    },
  });
}
