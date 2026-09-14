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
});
