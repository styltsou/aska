import type { S3Event } from "aws-lambda";
import { initializeSentry } from "../../image-shared/src/observability";
import { createTaskHandler } from "../../image-shared/src/task-handler";
import {
  processRemoteVideo,
  processStoredVideo,
  reportRemoteFailure,
  reportStoredFailure,
} from "./processor";

initializeSentry("video-processor");

type Job =
  | { kind: "remote-video"; uploadId: number }
  | {
      kind: "stored-video";
      bucket: string;
      objectKey: string;
      originalEtag: string;
      sizeBytes?: number;
    };

function parse(body: string): Job[] {
  const envelope = JSON.parse(body) as {
    kind?: string;
    uploadId?: unknown;
    Message?: string;
  };
  if (envelope.kind === "remote-video") {
    if (
      !Number.isSafeInteger(envelope.uploadId) ||
      Number(envelope.uploadId) <= 0
    )
      throw new Error("Invalid video import job");
    return [{ kind: "remote-video", uploadId: Number(envelope.uploadId) }];
  }
  const event = (
    envelope.Message ? JSON.parse(envelope.Message) : envelope
  ) as S3Event;
  if (!Array.isArray(event.Records)) return [];
  return event.Records.flatMap((record) => {
    const objectKey = decodeURIComponent(
      record.s3.object.key.replace(/\+/g, " "),
    );
    if (!/^[^/]+\/video\/[^/]+\/original\.(?:mp4|webm)$/i.test(objectKey))
      return [];
    return [
      {
        kind: "stored-video" as const,
        bucket: record.s3.bucket.name,
        objectKey,
        originalEtag: record.s3.object.eTag ?? "",
        sizeBytes: record.s3.object.size,
      },
    ];
  });
}

export const handler = createTaskHandler({
  pipeline: "video-processor",
  parse,
  process: async (jobs) => {
    for (const job of jobs) {
      if (job.kind === "remote-video") await processRemoteVideo(job.uploadId);
      else await processStoredVideo(job);
    }
  },
  reportTerminalFailure: async (jobs, error) => {
    for (const job of jobs) {
      if (job.kind === "remote-video")
        await reportRemoteFailure(job.uploadId, error);
      else
        await reportStoredFailure(
          {
            bucket: job.bucket,
            objectKey: job.objectKey,
            originalEtag: job.originalEtag,
          },
          error,
        );
    }
  },
});
