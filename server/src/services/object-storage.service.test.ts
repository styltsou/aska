import { describe, expect, it, vi } from "vitest";

vi.mock("@/config", () => ({
  env: {
    S3_BUCKET: "video-test-bucket",
    S3_REGION: "eu-central-1",
    S3_ACCESS_KEY_ID: "test",
    S3_SECRET_ACCESS_KEY: "test",
    S3_PRESIGNED_UPLOAD_EXPIRES_SECONDS: 900,
  },
}));

import { ObjectStorageService } from "./object-storage.service";

describe("video direct-upload signing", () => {
  it("requires a create-only S3 PUT", async () => {
    const result = await new ObjectStorageService().createPresignedPutUrl({
      key: "workspace/video/storage/original.mp4",
      contentType: "video/mp4",
      ifNoneMatch: true,
    });

    expect(result.headers["If-None-Match"]).toBe("*");
    expect(
      new URL(result.url).searchParams.get("X-Amz-SignedHeaders"),
    ).toContain("if-none-match");
  });
});
