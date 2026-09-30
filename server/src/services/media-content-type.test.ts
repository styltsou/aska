import { describe, expect, it } from "vitest";

import { classifyMediaContentType } from "./media-content-type";

describe("remote media content type", () => {
  it("classifies supported images and videos without consulting the URL suffix", () => {
    expect(classifyMediaContentType("image/webp")).toBe("image");
    expect(classifyMediaContentType("video/mp4")).toBe("video");
    expect(classifyMediaContentType("video/webm")).toBe("video");
  });

  it("rejects pages and unrelated content", () => {
    expect(classifyMediaContentType("text/html")).toBeNull();
    expect(classifyMediaContentType("application/octet-stream")).toBeNull();
  });
});
