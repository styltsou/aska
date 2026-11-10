import { describe, expect, it } from "vitest";

import type { ImageAsset } from "@/types/asset";
import { getImageNavigation } from "./image-navigation";

const images = ["image-1", "image-2", "image-3"].map(
  (id): ImageAsset => ({
    id,
    type: "image",
    url: `https://example.com/${id}.webp`,
    width: 100,
    height: 100,
  }),
);

describe("image viewer navigation", () => {
  it("stops at the beginning of the list", () => {
    const navigation = getImageNavigation(images, "image-1");

    expect(navigation.currentIndex).toBe(0);
    expect(navigation.previousAsset).toBeUndefined();
    expect(navigation.nextAsset?.id).toBe("image-2");
  });

  it("provides both directions from the middle", () => {
    const navigation = getImageNavigation(images, "image-2");

    expect(navigation.previousAsset?.id).toBe("image-1");
    expect(navigation.nextAsset?.id).toBe("image-3");
  });

  it("stops at the end of the list", () => {
    const navigation = getImageNavigation(images, "image-3");

    expect(navigation.previousAsset?.id).toBe("image-2");
    expect(navigation.nextAsset).toBeUndefined();
  });

  it("disables navigation when the current image is unavailable", () => {
    expect(getImageNavigation(images, "image-99")).toEqual({
      currentIndex: -1,
      previousAsset: undefined,
      nextAsset: undefined,
    });
  });
});
