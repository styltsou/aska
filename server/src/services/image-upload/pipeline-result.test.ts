import { describe, expect, it } from "vitest";

import type { ImagePipelineCallbackInput } from "@/dto/upload.dto";

import {
  makeVariantObjectKey,
  toStoredImageVariants,
  validateCompletedPipelineResult,
} from "./pipeline-result";

const upload = {
  storageId: "upload-1",
  originalObjectKey: "ingest/upload-1/original.jpg",
  contentType: "image/jpeg",
  sizeBytes: 2000,
};

const displayVariant = {
  role: "display" as const,
  objectKey: "assets/upload-1/display.webp",
  width: 1200,
  height: 800,
  contentType: "image/webp" as const,
  sizeBytes: 1000,
};

const previewVariant = {
  role: "preview" as const,
  objectKey: "assets/upload-1/preview.webp",
  width: 400,
  height: 267,
  contentType: "image/webp" as const,
  sizeBytes: 500,
};

const completedResult = {
  event: "image.variants.completed" as const,
  originalObjectKey: upload.originalObjectKey,
  originalEtag: "etag-1",
  width: 1200,
  height: 800,
  format: "jpeg",
  blurDataURL: "data:image/webp;base64,AA==",
  variants: [displayVariant, previewVariant],
} satisfies Extract<
  ImagePipelineCallbackInput,
  { event: "image.variants.completed" }
>;

describe("completed image pipeline result", () => {
  it("accepts the expected display and preview object keys", () => {
    expect(() =>
      validateCompletedPipelineResult(upload, completedResult),
    ).not.toThrow();
  });

  it("rejects duplicate roles even when the DTO shape is valid", () => {
    expect(() =>
      validateCompletedPipelineResult(upload, {
        ...completedResult,
        variants: [displayVariant, displayVariant],
      }),
    ).toThrow("Pipeline result is missing required variants");
  });

  it("rejects a variant stored outside the upload namespace", () => {
    expect(() =>
      validateCompletedPipelineResult(upload, {
        ...completedResult,
        variants: [
          { ...displayVariant, objectKey: "assets/other/display.webp" },
          previewVariant,
        ],
      }),
    ).toThrow("Pipeline variant key is invalid");
  });

  it("stores original metadata with the pipeline variants", () => {
    expect(toStoredImageVariants(upload, completedResult)).toEqual({
      original: {
        objectKey: "ingest/upload-1/original.jpg",
        width: 1200,
        height: 800,
        contentType: "image/jpeg",
        sizeBytes: 2000,
      },
      display: displayVariant,
      preview: previewVariant,
    });
  });

  it("builds deterministic variant object keys", () => {
    expect(makeVariantObjectKey("upload-1", "display")).toBe(
      "assets/upload-1/display.webp",
    );
  });
});
