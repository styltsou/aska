import { describe, expect, it } from "vitest";

import {
  CreateImageUploadSchema,
  CreateRemoteImageSchema,
  ImagePipelineCallbackSchema,
} from "./upload.dto";

const pipelineBase = {
  originalObjectKey: "ingest/upload-1/original.jpg",
  originalEtag: "etag-1",
};

const completedCallback = {
  ...pipelineBase,
  status: "completed" as const,
  width: 1200,
  height: 800,
  format: "jpeg",
  blurDataURL: "data:image/webp;base64,AA==",
  extractionVersion: 1,
  palette: [
    {
      hex: "#112233",
      oklabL: 0.2,
      oklabA: 0.1,
      oklabB: -0.1,
      coverage: 0.75,
      salience: 0.8,
      isAccent: true,
    },
  ],
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
};

describe("ImagePipelineCallbackSchema", () => {
  it("accepts each supported callback state", () => {
    expect(
      ImagePipelineCallbackSchema.safeParse({
        ...pipelineBase,
        status: "processing",
      }).success,
    ).toBe(true);
    expect(
      ImagePipelineCallbackSchema.safeParse(completedCallback).success,
    ).toBe(true);
    expect(
      ImagePipelineCallbackSchema.safeParse({
        ...pipelineBase,
        status: "failed",
        error: "Unable to decode image",
      }).success,
    ).toBe(true);
  });

  it("rejects an unsupported callback state", () => {
    expect(
      ImagePipelineCallbackSchema.safeParse({
        ...pipelineBase,
        status: "skipped",
      }).success,
    ).toBe(false);
  });

  it("rejects incomplete completed callbacks", () => {
    expect(
      ImagePipelineCallbackSchema.safeParse({
        ...completedCallback,
        variants: [completedCallback.variants[0]],
      }).success,
    ).toBe(false);
    expect(
      ImagePipelineCallbackSchema.safeParse({
        ...completedCallback,
        width: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid variant and palette metadata", () => {
    expect(
      ImagePipelineCallbackSchema.safeParse({
        ...completedCallback,
        palette: [{ ...completedCallback.palette[0], hex: "not-a-colour" }],
      }).success,
    ).toBe(false);
    expect(
      ImagePipelineCallbackSchema.safeParse({
        ...completedCallback,
        variants: [
          { ...completedCallback.variants[0], contentType: "image/png" },
          completedCallback.variants[1],
        ],
      }).success,
    ).toBe(false);
  });
});

describe("image upload request DTOs", () => {
  it("accepts a direct image upload with board placement", () => {
    expect(
      CreateImageUploadSchema.parse({
        fileName: "reference.png",
        contentType: "image/png",
        sizeBytes: 1024,
        position: { x: 48, y: 96 },
      }),
    ).toMatchObject({
      fileName: "reference.png",
      contentType: "image/png",
      position: { x: 48, y: 96 },
    });
  });

  it("rejects invalid direct and remote image requests", () => {
    expect(
      CreateImageUploadSchema.safeParse({
        fileName: "reference.svg",
        contentType: "image/svg+xml",
        sizeBytes: 1024,
      }).success,
    ).toBe(false);
    expect(
      CreateImageUploadSchema.safeParse({
        fileName: "reference.png",
        contentType: "image/png",
        sizeBytes: 0,
      }).success,
    ).toBe(false);
    expect(
      CreateRemoteImageSchema.safeParse({ url: "not-a-url" }).success,
    ).toBe(false);
  });
});
