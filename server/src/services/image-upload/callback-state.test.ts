import { describe, expect, it } from "vitest";

import type { ImagePipelineCallbackInput } from "@/dto/upload.dto";

import { resolvePipelineCallbackAction } from "./callback-state";

const originalObjectKey = "ingest/upload-1/original.jpg";

const processingInput = {
  status: "processing",
  originalObjectKey,
  originalEtag: "etag-1",
} satisfies ImagePipelineCallbackInput;

const failedInput = {
  ...processingInput,
  status: "failed" as const,
  error: "Unable to decode image",
} satisfies ImagePipelineCallbackInput;

const completedInput = {
  ...processingInput,
  status: "completed" as const,
  width: 1200,
  height: 800,
  format: "jpeg",
  blurDataURL: "data:image/webp;base64,AA==",
  extractionVersion: 1,
  palette: [],
  variants: [
    {
      role: "display" as const,
      objectKey: "assets/upload-1/display.webp",
      width: 1200,
      height: 800,
      contentType: "image/webp" as const,
      sizeBytes: 1000,
    },
    {
      role: "preview" as const,
      objectKey: "assets/upload-1/preview.webp",
      width: 400,
      height: 267,
      contentType: "image/webp" as const,
      sizeBytes: 500,
    },
  ],
} satisfies ImagePipelineCallbackInput;

describe("pipeline callback state machine", () => {
  it("ignores unknown uploads and non-ingest callbacks", () => {
    expect(resolvePipelineCallbackAction(undefined, processingInput)).toEqual({
      type: "ignore",
      ignored: true,
    });
    expect(
      resolvePipelineCallbackAction(undefined, {
        ...processingInput,
        originalObjectKey: "assets/upload-1/display.webp",
      }),
    ).toEqual({ type: "ignore", ignored: true });
  });

  it("ignores stale callbacks and terminal failures", () => {
    expect(
      resolvePipelineCallbackAction(
        { status: "processing", processingEtag: "etag-0" },
        processingInput,
      ),
    ).toEqual({ type: "ignore", ignored: true });
    expect(
      resolvePipelineCallbackAction(
        { status: "failed", processingEtag: "etag-1" },
        processingInput,
      ),
    ).toEqual({ type: "ignore", ignored: true });
  });

  it("treats duplicate completed callbacks as successful no-ops", () => {
    expect(
      resolvePipelineCallbackAction(
        { status: "completed", processingEtag: "etag-1" },
        completedInput,
      ),
    ).toEqual({ type: "ignore", ignored: false });
  });

  it("maps active uploads to their callback side effects", () => {
    const upload = { status: "uploaded" as const, processingEtag: null };

    expect(resolvePipelineCallbackAction(upload, processingInput)).toEqual({
      type: "mark-processing",
    });
    expect(resolvePipelineCallbackAction(upload, failedInput)).toEqual({
      type: "mark-failed",
    });
    expect(resolvePipelineCallbackAction(upload, completedInput)).toEqual({
      type: "finalize",
    });
  });
});
