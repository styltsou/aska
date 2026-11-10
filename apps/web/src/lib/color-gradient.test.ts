import { describe, expect, it } from "vitest";

import { colorAtPosition, gradientToCss } from "@/lib/color-gradient";

describe("color gradients", () => {
  it("renders positioned linear and radial stops", () => {
    const stops = [
      { color: "#000000", position: 0 },
      { color: "#ffffff", position: 100 },
    ];

    expect(gradientToCss(stops, "linear", 90)).toBe(
      "linear-gradient(90deg, #000000 0%, #ffffff 100%)",
    );
    expect(gradientToCss(stops, "radial", 90)).toBe(
      "radial-gradient(circle, #000000 0%, #ffffff 100%)",
    );
  });

  it("interpolates the color for a newly inserted stop", () => {
    expect(
      colorAtPosition(
        [
          { id: "start", color: "#000000", position: 0 },
          { id: "end", color: "#ffffff", position: 100 },
        ],
        50,
      ),
    ).toBe("#808080");
  });

  it("preserves opacity when interpolating a newly inserted stop", () => {
    expect(
      colorAtPosition(
        [
          { id: "start", color: "#ff000000", position: 0 },
          { id: "end", color: "#ff0000ff", position: 100 },
        ],
        50,
      ),
    ).toBe("#ff000080");
  });
});
