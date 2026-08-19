import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { processResourceImage } from "./processor";

describe("resource image processing profiles", () => {
  it("creates responsive preview variants without upscaling", async () => {
    const source = await sharp({
      create: { width: 200, height: 100, channels: 3, background: "#336699" },
    })
      .png()
      .toBuffer();
    const result = await processResourceImage(source, "link-preview-v1");
    expect(result.variants.map((variant) => variant.role)).toEqual([
      "master",
      "display",
      "preview",
    ]);
    expect(result.variants.every((variant) => variant.width <= 200)).toBe(true);
    expect(result.blurDataURL).toMatch(/^data:image\/webp;base64,/);
  });

  it("uses the isolated icon profile", async () => {
    const source = await sharp({
      create: { width: 128, height: 128, channels: 3, background: "#111111" },
    })
      .png()
      .toBuffer();
    const result = await processResourceImage(source, "icon-v1");
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]?.width).toBe(64);
    expect(result.blurDataURL).toBeNull();
  });
});
