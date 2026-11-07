import { describe, expect, it } from "vitest";

import { getPreviewStackTransforms } from "./preview-stack-motion";

describe("mixed-ratio preview stacks", () => {
  it("preserves a wide rear card's size and outward spill", () => {
    const transforms = getPreviewStackTransforms(
      [
        { width: 150, height: 240 },
        { width: 250, height: 140 },
      ],
      { width: 280, height: 280 },
      true,
    );

    expect(transforms).toHaveLength(2);
    expect(transforms[1].scale).toBe(transforms[0].scale);
    expect(250 * transforms[1].scale).toBeGreaterThan(
      150 * transforms[0].scale,
    );
  });

  it("uses the same scale before and after the fan opens", () => {
    const sizes = [
      { width: 210, height: 120 },
      { width: 100, height: 220 },
      { width: 195, height: 125 },
    ];
    const frame = { width: 280, height: 187 };
    const resting = getPreviewStackTransforms(sizes, frame, false);
    const open = getPreviewStackTransforms(sizes, frame, true);

    expect(resting.map((pose) => pose.scale)).toEqual(
      open.map((pose) => pose.scale),
    );
    expect(resting).not.toEqual(open);
  });
});
