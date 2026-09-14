import { describe, expect, it } from "vitest";

import { ResourceMediaResultSchema } from "./url-unfurl.dto";

describe("resource media result contract", () => {
  it("accepts the display-only manifest used by link-preview-v2", () => {
    const result = ResourceMediaResultSchema.safeParse({
      event: "resource.media.completed",
      id: 7,
      generation: 2,
      width: 1_200,
      height: 630,
      format: "jpeg",
      sizeBytes: 50_000,
      blurDataURL: null,
      variants: {
        display: {
          objectKey: "org/storage/display.webp",
          width: 960,
          height: 504,
          contentType: "image/webp",
          sizeBytes: 24_000,
        },
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects a completed result without a stored rendition", () => {
    const result = ResourceMediaResultSchema.safeParse({
      event: "resource.media.completed",
      id: 7,
      generation: 2,
      width: 1,
      height: 1,
      format: "png",
      sizeBytes: 1,
      blurDataURL: null,
      variants: {},
    });

    expect(result.success).toBe(false);
  });
});
