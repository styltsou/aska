import { describe, expect, it } from "vitest";

import { colorAssetToSearchColors } from "./color-asset-search";

describe("colorAssetToSearchColors", () => {
  it("creates one fully weighted query color for a solid color", () => {
    expect(
      colorAssetToSearchColors({
        id: "color-1",
        type: "color",
        hex: "#cc3366",
      }),
    ).toMatchObject([{ weight: 1 }]);
  });

  it("preserves all distinct gradient stops and normalizes their span weights", () => {
    const colors = colorAssetToSearchColors({
      id: "color-1",
      type: "color",
      hex: "#ff0000",
      gradient: {
        from: "#ff0000",
        to: "#0000ff",
        angle: 90,
        stops: [
          { color: "#ff0000", position: 0 },
          { color: "#00ff00", position: 20 },
          { color: "#0000ff", position: 100 },
        ],
      },
    });

    expect(colors).toHaveLength(3);
    expect(colors.reduce((sum, color) => sum + color.weight, 0)).toBeCloseTo(1);
    expect(colors[1]!.weight).toBeGreaterThan(colors[0]!.weight);
  });
});
