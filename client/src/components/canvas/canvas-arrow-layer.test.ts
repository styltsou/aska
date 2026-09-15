import { describe, expect, it } from "vitest";

import { makeArrowPath } from "./canvas-arrow-layer";

describe("canvas arrow paths", () => {
  it("renders clean arrows as straight segments", () => {
    expect(
      makeArrowPath("arrow-1", { x: 10, y: 20 }, { x: 90, y: 70 }, "clean"),
    ).toBe("M 10 20 L 90 70");
  });

  it("keeps sketch geometry deterministic for a persisted id", () => {
    const first = makeArrowPath(
      "arrow-42",
      { x: -10, y: 5 },
      { x: 160, y: 80 },
      "sketch",
    );
    expect(
      makeArrowPath("arrow-42", { x: -10, y: 5 }, { x: 160, y: 80 }, "sketch"),
    ).toBe(first);
    expect(first).toContain(" Q ");
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
});
