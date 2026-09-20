import { describe, expect, it } from "vitest";

import {
  arrowheadSketchJitter,
  arrowMarkerRefX,
  makeArrowPath,
  makeArrowPaths,
} from "./canvas-arrow-geometry";

describe("canvas arrow paths", () => {
  it("renders clean arrows as straight segments", () => {
    const paths = makeArrowPaths(
      "arrow-1",
      [
        { x: 10, y: 20 },
        { x: 90, y: 70 },
      ],
      "clean",
      "straight",
    );
    expect(
      makeArrowPath("arrow-1", { x: 10, y: 20 }, { x: 90, y: 70 }, "clean"),
    ).toBe("M 10 20 L 90 70");
    expect(paths.segmentAnchors).toEqual([{ x: 50, y: 45 }]);
  });

  it("keeps sketch geometry deterministic for a persisted id", () => {
    const first = makeArrowPaths(
      "arrow-42",
      [
        { x: -10, y: 5 },
        { x: 160, y: 80 },
      ],
      "sketch",
      "straight",
    );
    expect(
      makeArrowPaths(
        "arrow-42",
        [
          { x: -10, y: 5 },
          { x: 160, y: 80 },
        ],
        "sketch",
        "straight",
      ),
    ).toEqual(first);
    expect(first.primary).toContain(" Q ");
    expect(first.secondary).toContain(" Q ");
    expect(first.primary).toMatch(/ 160 80$/);
    expect(first.secondary).toMatch(/ 160 80$/);
    expect(first.segmentAnchors).toHaveLength(1);
    expect(first.secondarySegmentAnchors).toHaveLength(1);
    expect(
      makeArrowPaths(
        "arrow-43",
        [
          { x: -10, y: 5 },
          { x: 160, y: 80 },
        ],
        "sketch",
        "straight",
      ).primary,
    ).not.toBe(first.primary);
  });

  it("uses every persisted bend point for straight and smooth routes", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 40, y: 80 },
      { x: 120, y: 20 },
      { x: 180, y: 60 },
    ];

    expect(makeArrowPath("arrow-3", points, "clean", "straight")).toBe(
      "M 0 0 L 40 80 L 120 20 L 180 60",
    );
    expect(makeArrowPath("arrow-3", points, "clean", "smooth")).toContain(
      " C ",
    );
  });

  it("sketches every straight segment and preserves smooth routing", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 40, y: 80 },
      { x: 120, y: 20 },
      { x: 180, y: 60 },
    ];
    const straight = makeArrowPaths("arrow-9", points, "sketch", "straight");
    const smooth = makeArrowPaths("arrow-9", points, "sketch", "smooth");

    expect(straight.primary.match(/ Q /g)).toHaveLength(3);
    expect(straight.secondary?.match(/ Q /g)).toHaveLength(3);
    expect(smooth.primary).toContain(" C ");
    expect(smooth.secondary).toContain(" C ");
    expect(smooth.segmentAnchors).toHaveLength(3);
    expect(
      straight.segmentAnchors.every((anchor, index) => {
        const secondary = straight.secondarySegmentAnchors?.[index];
        return (
          secondary !== undefined &&
          Math.hypot(anchor.x - secondary.x, anchor.y - secondary.y) >= 1.25
        );
      }),
    ).toBe(true);
  });

  it("keeps repeated and zero-length points finite", () => {
    const paths = makeArrowPaths(
      "arrow-11",
      [
        { x: 12, y: 12 },
        { x: 12, y: 12 },
        { x: 12, y: 12 },
      ],
      "sketch",
      "straight",
    );

    expect(`${paths.primary}${paths.secondary}`).not.toMatch(/NaN|Infinity/);
  });

  it("keeps both arrowhead traces deterministic and independently seeded", () => {
    const primary = arrowheadSketchJitter("arrow-42", "primary");
    const secondary = arrowheadSketchJitter("arrow-42", "secondary");

    expect(arrowheadSketchJitter("arrow-42", "primary")).toEqual(primary);
    expect(secondary).not.toEqual(primary);
    expect(arrowheadSketchJitter("arrow-43", "primary")).not.toEqual(primary);
  });

  it("moves only the clean filled marker forward to cover the shaft cap", () => {
    expect(arrowMarkerRefX("clean", "filled")).toBeLessThan(8);
    expect(arrowMarkerRefX("clean", "hollow")).toBe(8);
    expect(arrowMarkerRefX("clean", "chevron")).toBe(8);
    expect(arrowMarkerRefX("sketch", "filled")).toBe(8);
  });
});
