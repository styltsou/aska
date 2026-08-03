import type { SQSBatchResponse, SQSHandler, S3Event } from "aws-lambda";
import type { Span } from "@opentelemetry/api";

import {
  flushObservability,
  log,
  markSpanError,
  recordMessageDuration,
  runWithSpan,
} from "./observability";
import { isOriginalImageObjectKey } from "./pipeline-callback";

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
    return isOriginalImageObjectKey(source.objectKey) && source.originalEtag
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
  const handle = async (event: {
    Records: Array<{
      messageId: string;
      body: string;
      attributes: { ApproximateReceiveCount?: string };
    }>;
  }): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

    for (const message of event.Records) {
      const attempts = Number(
        message.attributes.ApproximateReceiveCount ?? "1",
      );
      const startedAt = performance.now();
      let outcome: "success" | "error" = "success";
      await runWithSpan(
        `image.${pipeline}.process`,
        {
          "messaging.system": "aws_sqs",
          "messaging.message.id": message.messageId,
          "messaging.destination.name": pipeline,
          "aws.sqs.approximate_receive_count": attempts,
        },
        async (span) => {
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
              log("error", "image terminal failure callback failed", {
                event: `image_${pipeline}.failure_callback_failed`,
                messageId: message.messageId,
                attempts,
                error: String(callbackError),
              });
              markSpanError(span, callbackError);
              batchItemFailures.push({ itemIdentifier: message.messageId });
            }
            outcome = "error";
            return;
          }

          try {
            const s3Event = parseS3Event(message.body);
            for (const source of sourcesFromS3Event(s3Event))
              await process(source);
          } catch (error) {
            const detail =
              error instanceof Error
                ? error.message
                : "Unknown image processing error";
            log("error", "image processing failed", {
              event: `image_${pipeline}.failed`,
              messageId: message.messageId,
              attempts,
              error: detail,
            });
            markSpanError(span, error);
            outcome = "error";

            if (attempts < MAX_PROCESSING_ATTEMPTS) {
              batchItemFailures.push({ itemIdentifier: message.messageId });
              return;
            }

            try {
              const s3Event = parseS3Event(message.body);
              for (const source of sourcesFromS3Event(s3Event)) {
                await reportTerminalFailure(source, detail.slice(0, 1000));
              }
            } catch (callbackError) {
              log("error", "image terminal failure callback failed", {
                event: `image_${pipeline}.failure_callback_failed`,
                messageId: message.messageId,
                error: String(callbackError),
              });
              batchItemFailures.push({ itemIdentifier: message.messageId });
            }
          }
        },
      );
      recordMessageDuration(pipeline, outcome, performance.now() - startedAt);
    }

    return { batchItemFailures };
  };

  return async (event) => {
    try {
      return await handle(event);
    } finally {
      await flushObservability();
    }
  };
}
