import type { SQSEvent } from "aws-lambda";
import { describe, expect, it, vi } from "vitest";

import { createSqsHandler } from "./sqs-handler";

const sourceEvent = {
  Records: [
    {
      s3: {
        bucket: { name: "aska-dev" },
        object: {
          key: "ingest%2Fupload-1%2Foriginal.jpg",
          eTag: "etag-1",
          size: 1234,
        },
      },
    },
  ],
};

function sqsEvent(body: unknown, attempts = 1): SQSEvent {
  return {
    Records: [
      {
        messageId: "message-1",
        receiptHandle: "receipt",
        body: JSON.stringify(body),
        attributes: {
          ApproximateReceiveCount: String(attempts),
          ApproximateFirstReceiveTimestamp: "0",
          SenderId: "s3",
          SentTimestamp: "0",
        },
        messageAttributes: {},
        md5OfBody: "",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:eu-central-1:123456789:queue",
        awsRegion: "eu-central-1",
      },
    ],
  };
}

function handlerFor(
  process = vi.fn(async () => undefined),
  reportTerminalFailure = vi.fn(async () => undefined),
) {
  return {
    process,
    reportTerminalFailure,
    handler: createSqsHandler({
      pipeline: "palette",
      process,
      reportTerminalFailure,
    }),
  };
}

describe("SQS image processor retry contract", () => {
  it("acknowledges S3 test notifications without processing", async () => {
    const { handler, process } = handlerFor();

    const result = await handler(
      sqsEvent({ Event: "s3:TestEvent" }),
      {} as never,
      () => undefined,
    );

    expect(result).toEqual({ batchItemFailures: [] });
    expect(process).not.toHaveBeenCalled();
  });

  it("retries ordinary processing failures before the terminal receive", async () => {
    const process = vi.fn(async () => {
      throw new Error("sharp failed");
    });
    const { handler, reportTerminalFailure } = handlerFor(process);

    const result = await handler(
      sqsEvent(sourceEvent),
      {} as never,
      () => undefined,
    );

    expect(result).toEqual({
      batchItemFailures: [{ itemIdentifier: "message-1" }],
    });
    expect(reportTerminalFailure).not.toHaveBeenCalled();
  });

  it("reports the processor's own terminal failure on receive five", async () => {
    const process = vi.fn(async () => {
      throw new Error("sharp failed");
    });
    const { handler, reportTerminalFailure } = handlerFor(process);

    const result = await handler(
      sqsEvent(sourceEvent, 5),
      {} as never,
      () => undefined,
    );

    expect(result).toEqual({ batchItemFailures: [] });
    expect(reportTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ objectKey: "ingest/upload-1/original.jpg" }),
      "sharp failed",
    );
  });

  it("uses the final receive only to retry a terminal callback", async () => {
    const { handler, process, reportTerminalFailure } = handlerFor();

    const result = await handler(
      sqsEvent(sourceEvent, 6),
      {} as never,
      () => undefined,
    );

    expect(result).toEqual({ batchItemFailures: [] });
    expect(process).not.toHaveBeenCalled();
    expect(reportTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({ objectKey: "ingest/upload-1/original.jpg" }),
      "Image processing failed before its terminal callback could be delivered",
    );
  });
});
