import { describe, expect, it } from "vitest";

import { findMinimumCostColorAssignment } from "./color-assignment";

const palette = [
  {
    id: 1,
    hex: "#d94732",
    oklabL: 0.628,
    oklabA: 0.225,
    oklabB: 0.126,
    coverage: 0.6,
    salience: 0.8,
    isAccent: false,
  },
  {
    id: 2,
    hex: "#75c56a",
    oklabL: 0.728,
    oklabA: -0.171,
    oklabB: 0.091,
    coverage: 0.2,
    salience: 0.9,
    isAccent: true,
  },
];

describe("findMinimumCostColorAssignment", () => {
  it("assigns every requested color to a distinct palette entry", () => {
    const assignment = findMinimumCostColorAssignment(
      [
        { oklabL: 0.628, oklabA: 0.225, oklabB: 0.126 },
        { oklabL: 0.728, oklabA: -0.171, oklabB: 0.091 },
      ],
      palette,
      0.16,
    );

    expect(assignment?.matches.map((match) => match.paletteColor.id)).toEqual([
      1, 2,
    ]);
  });

  it("does not let one palette entry satisfy two requested colors", () => {
    const assignment = findMinimumCostColorAssignment(
      [
        { oklabL: 0.628, oklabA: 0.225, oklabB: 0.126 },
        { oklabL: 0.635, oklabA: 0.22, oklabB: 0.13 },
      ],
      [palette[0]!],
      0.16,
    );

    expect(assignment).toBeNull();
  });

  it("minimizes perceptual distance before considering prominence", () => {
    const assignment = findMinimumCostColorAssignment(
      [{ oklabL: 0.628, oklabA: 0.225, oklabB: 0.126 }],
      [
        { ...palette[0]!, coverage: 0, salience: 0 },
        {
          ...palette[1]!,
          id: 3,
          oklabL: 0.64,
          oklabA: 0.225,
          oklabB: 0.126,
          coverage: 1,
          salience: 1,
        },
      ],
      0.16,
    );

    expect(assignment?.matches[0]?.paletteColor.id).toBe(1);
  });
});
