import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { processImageVariants } from "./processor";

describe("image rendition profiles", () => {
  it("creates upload variants without a redundant master", async () => {
    const result = await processImageVariants(
      await testImage(1_200, 600),
      "upload-v1",
    );
    expect(result.variants.map((variant) => variant.role)).toEqual([
      "display",
      "preview",
    ]);
  });

  it("creates responsive link-preview variants without upscaling", async () => {
    const result = await processImageVariants(
      await testImage(200, 100),
      "link-preview-v1",
    );
    expect(result.variants.map((variant) => variant.role)).toEqual([
      "master",
      "display",
      "preview",
    ]);
    expect(result.variants.every((variant) => variant.width <= 200)).toBe(true);
    expect(result.blurDataURL).toMatch(/^data:image\/webp;base64,/);
  });

  it("uses the isolated icon profile", async () => {
    const result = await processImageVariants(
      await testImage(128, 128),
      "icon-v1",
    );
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0]?.role).toBe("master");
    expect(result.variants[0]?.width).toBe(64);
    expect(result.blurDataURL).toBeNull();
  });

  it("rejects unknown profiles instead of silently using upload defaults", async () => {
    await expect(
      processImageVariants(
        await testImage(100, 100),
        "future-profile" as "upload-v1",
      ),
    ).rejects.toThrow("unsupported_processing_profile");
  });
});

async function testImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();
}
