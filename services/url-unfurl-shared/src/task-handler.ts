import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import * as Sentry from "@sentry/aws-serverless";

import {
  captureException,
  recordMessageDuration,
  runWithSpan,
} from "../../image-shared/src/observability";

export function createTaskHandler<T>(input: {
  pipeline: string;
  parse(body: string): T;
  process(task: T): Promise<void>;
  reportTerminalFailure(task: T, error: unknown): Promise<void>;
  maxAttempts?: number;
}) {
  const handle = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
    for (const record of event.Records) {
      const startedAt = Date.now();
      let task: T;
      try {
        task = input.parse(record.body);
      } catch (error) {
        captureException(error, {
          pipeline: input.pipeline,
          messageId: record.messageId,
          attempts: Number(record.attributes.ApproximateReceiveCount ?? "1"),
        });
        recordMessageDuration(input.pipeline, "error", Date.now() - startedAt);
        continue;
      }
      const attempts = Number(record.attributes.ApproximateReceiveCount ?? "1");
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
        captureException(error, {
          pipeline: input.pipeline,
          messageId: record.messageId,
          attempts,
        });
        recordMessageDuration(input.pipeline, "error", Date.now() - startedAt);
        const terminal =
          attempts >= (input.maxAttempts ?? 5) ||
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
