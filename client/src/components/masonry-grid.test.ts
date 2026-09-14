import { describe, expect, it } from "vitest";

import { calculateMasonryLayout } from "./masonry-grid";

describe("calculateMasonryLayout", () => {
  it("places each item in the shortest available column", () => {
    expect(calculateMasonryLayout([100, 200, 80, 120], 2, 300)).toEqual({
      positions: [
        { x: 0, y: 0, width: 300 },
        { x: 310, y: 0, width: 300 },
        { x: 0, y: 110, width: 300 },
        { x: 0, y: 200, width: 300 },
      ],
      height: 320,
    });
  });

  it("waits until every rendered item has a measurable height", () => {
    expect(calculateMasonryLayout([100, 0], 2, 300)).toBeUndefined();
    expect(calculateMasonryLayout([], 2, 300)).toBeUndefined();
  });
});
