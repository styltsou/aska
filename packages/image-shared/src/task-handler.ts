import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import * as Sentry from "@sentry/aws-serverless";

import {
  captureException,
  log,
  recordMessageDuration,
  runWithSpan,
} from "./observability";
import { TASK_MAX_PROCESSING_ATTEMPTS } from "./task-timing";

/** Applies the common at-least-once retry and terminal-callback contract. */
export function createTaskHandler<T>(input: {
  pipeline: string;
  parse(body: string): T;
  process(task: T): Promise<void>;
  reportTerminalFailure(task: T, error: unknown): Promise<void>;
  maxAttempts?: number;
}) {
  const maxAttempts = input.maxAttempts ?? TASK_MAX_PROCESSING_ATTEMPTS;
  const handle = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
    for (const record of event.Records) {
      const startedAt = Date.now();
      const attempts = Number(record.attributes.ApproximateReceiveCount ?? "1");
      let task: T;
      try {
        task = input.parse(record.body);
      } catch (error) {
        log("error", "queued task payload rejected", {
          event: `${input.pipeline}.invalid_payload`,
          messageId: record.messageId,
          attempts,
          error,
        });
        captureException(error, {
          pipeline: input.pipeline,
          messageId: record.messageId,
          attempts,
        });
        recordMessageDuration(input.pipeline, "error", Date.now() - startedAt);
        continue;
      }
      if (attempts > maxAttempts) {
        try {
          await input.reportTerminalFailure(
            task,
            new Error(
              "Task failed before its terminal callback could be delivered",
            ),
          );
        } catch (callbackError) {
          captureException(callbackError, {
            pipeline: `${input.pipeline}.failure_callback`,
            messageId: record.messageId,
            attempts,
          });
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
        recordMessageDuration(input.pipeline, "error", Date.now() - startedAt);
        continue;
      }
      try {
        await runWithSpan(
          `${input.pipeline}.process`,
          {
            "messaging.system": "aws_sqs",
            "messaging.message.id": record.messageId,
            "messaging.message.receive_count": attempts,
          },
          async () => input.process(task),
        );
        recordMessageDuration(
          input.pipeline,
          "success",
          Date.now() - startedAt,
        );
      } catch (error) {
        log("error", "queued task processing failed", {
          event: `${input.pipeline}.failed`,
          messageId: record.messageId,
          attempts,
          error,
        });
        captureException(error, {
          pipeline: input.pipeline,
          messageId: record.messageId,
          attempts,
        });
        recordMessageDuration(input.pipeline, "error", Date.now() - startedAt);
        const terminal =
          attempts >= maxAttempts ||
          (error instanceof Error &&
            "retryable" in error &&
            error.retryable === false);
        if (!terminal) {
          batchItemFailures.push({ itemIdentifier: record.messageId });
          continue;
        }
        try {
          await input.reportTerminalFailure(task, error);
        } catch (callbackError) {
          captureException(callbackError, {
            pipeline: `${input.pipeline}.failure_callback`,
            messageId: record.messageId,
            attempts,
          });
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      }
    }
    return { batchItemFailures };
  };
  return Sentry.wrapHandler(handle, { flushTimeout: 2_000 });
}
