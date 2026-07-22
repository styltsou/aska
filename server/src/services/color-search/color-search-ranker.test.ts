import { describe, expect, it } from "vitest";

import {
  applyAdaptiveCutoff,
  normalizeQueryColors,
  rankPalette,
} from "./color-search-ranker";

const queryColor = { oklabL: 0.628, oklabA: 0.225, oklabB: 0.126 };

const matchingPalette = [
  {
    id: 1,
    hex: "#d94732",
    ...queryColor,
    coverage: 0.4,
    salience: 0.6,
    isAccent: false,
  },
];

describe("color search ranker", () => {
  it("removes effectively duplicate requested colors while retaining the first", () => {
    expect(
      normalizeQueryColors([
        queryColor,
        { oklabL: 0.631, oklabA: 0.225, oklabB: 0.126 },
        { oklabL: 0.728, oklabA: -0.171, oklabB: 0.091 },
      ]),
    ).toEqual([queryColor, { oklabL: 0.728, oklabA: -0.171, oklabB: 0.091 }]);
  });

  it("requires every selected color to have a palette assignment", () => {
    expect(
      rankPalette(
        1,
        [queryColor, { oklabL: 0.728, oklabA: -0.171, oklabB: 0.091 }],
        matchingPalette,
      ),
    ).toBeNull();
  });

  it("keeps a small high-salience accent searchable", () => {
    const ranked = rankPalette(
      1,
      [queryColor],
      [{ ...matchingPalette[0]!, coverage: 0.01, salience: 1, isAccent: true }],
    );

    expect(ranked?.relevance).toBeGreaterThan(0.6);
  });

  it("orders equal relevance by descending asset id", () => {
    const result = applyAdaptiveCutoff([
      { assetId: 1, relevance: 0.8, matches: [] },
      { assetId: 2, relevance: 0.8, matches: [] },
    ]);

    expect(result.results.map((candidate) => candidate.assetId)).toEqual([
      2, 1,
    ]);
  });

  it("does not weaken the absolute relevance floor for a poor result set", () => {
    const result = applyAdaptiveCutoff([
      { assetId: 1, relevance: 0.23, matches: [] },
      { assetId: 2, relevance: 0.2, matches: [] },
    ]);

    expect(result.results).toEqual([]);
    expect(result.cutoff).toBe(0.24);
  });
});
