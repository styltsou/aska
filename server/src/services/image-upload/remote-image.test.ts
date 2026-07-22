import { describe, expect, it } from "vitest";

import {
  fileNameFromRemoteImageUrl,
  makeOriginalObjectKey,
  normalizeRemoteImageContentType,
  parseRemoteImageUrl,
} from "./remote-image";

describe("remote image helpers", () => {
  it("accepts HTTP(S) URLs and rejects unsupported protocols", () => {
    expect(
      parseRemoteImageUrl("https://example.com/images/hero.png").hostname,
    ).toBe("example.com");
    expect(() => parseRemoteImageUrl("ftp://example.com/hero.png")).toThrow(
      "Remote image URL must use HTTP or HTTPS",
    );
  });

  it("normalizes supported content-type headers", () => {
    expect(normalizeRemoteImageContentType(" Image/PNG; charset=utf-8 ")).toBe(
      "image/png",
    );
    expect(() => normalizeRemoteImageContentType("text/html")).toThrow(
      "Remote URL did not return a supported image type",
    );
  });

  it("uses the URL filename or a content-type fallback", () => {
    expect(
      fileNameFromRemoteImageUrl(
        parseRemoteImageUrl("https://example.com/images/hero.png?version=2"),
        "image/png",
      ),
    ).toBe("hero.png");
    expect(
      fileNameFromRemoteImageUrl(
        parseRemoteImageUrl("https://example.com/"),
        "image/webp",
      ),
    ).toBe("remote-image.webp");
  });

  it("derives an original-object extension from the filename or content type", () => {
    expect(makeOriginalObjectKey("upload-1", "Photo.JPEG", "image/jpeg")).toBe(
      "ingest/upload-1/original.jpg",
    );
    expect(makeOriginalObjectKey("upload-1", "untitled", "image/gif")).toBe(
      "ingest/upload-1/original.gif",
    );
  });
});
