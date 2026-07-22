import { describe, expect, it } from "vitest";

import { hexToOklab } from "./oklab";

describe("hexToOklab", () => {
  it("uses the same fixed vectors as the image pipeline", () => {
    const red = hexToOklab("#ff0000");

    expect(red.oklabL).toBeCloseTo(0.627955, 5);
    expect(red.oklabA).toBeCloseTo(0.224863, 5);
    expect(red.oklabB).toBeCloseTo(0.125846, 5);
    const white = hexToOklab("#ffffff");
    expect(white.oklabL).toBeCloseTo(1, 7);
    expect(white.oklabA).toBeCloseTo(0, 7);
    expect(white.oklabB).toBeCloseTo(0, 7);
  });

  it("rejects display values that are not six-digit sRGB hex colors", () => {
    expect(() => hexToOklab("red")).toThrow("six-digit sRGB hex color");
    expect(() => hexToOklab("#fff")).toThrow("six-digit sRGB hex color");
  });
});
