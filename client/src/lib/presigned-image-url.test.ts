import { describe, expect, it } from "vitest";
import {
  rememberPresignedImageUrl,
  resolvePresignedImageUrl,
} from "./presigned-image-url";

const issuedAt = Date.UTC(2026, 6, 24, 12, 0, 0);
const firstUrl =
  "https://assets.s3.eu-central-1.amazonaws.com/assets/1/display.webp?X-Amz-Date=20260724T120000Z&X-Amz-Expires=900&X-Amz-Signature=first";
const refreshedUrl =
  "https://assets.s3.eu-central-1.amazonaws.com/assets/1/display.webp?X-Amz-Date=20260724T120100Z&X-Amz-Expires=900&X-Amz-Signature=second";

describe("presigned image URL cache", () => {
  it("keeps a valid URL when a refetch supplies a new signature", () => {
    rememberPresignedImageUrl(firstUrl, issuedAt);

    expect(resolvePresignedImageUrl(refreshedUrl, issuedAt + 60_000)).toBe(
      firstUrl,
    );
  });

  it("uses a fresh URL when the cached one is close to expiry", () => {
    rememberPresignedImageUrl(firstUrl, issuedAt);

    expect(resolvePresignedImageUrl(refreshedUrl, issuedAt + 841_000)).toBe(
      refreshedUrl,
    );
  });

  it("does not reuse a URL for another S3 object", () => {
    rememberPresignedImageUrl(firstUrl, issuedAt);
    const otherObjectUrl = refreshedUrl.replace("/1/", "/2/");

    expect(resolvePresignedImageUrl(otherObjectUrl, issuedAt + 60_000)).toBe(
      otherObjectUrl,
    );
  });
});
