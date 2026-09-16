import { describe, expect, it } from "vitest";

import {
  CANVAS_OBJECT_COLORS,
  CANVAS_OBJECT_OVERFLOW_COLORS,
  CANVAS_OBJECT_VISIBLE_COLORS,
  canvasObjectColorMarker,
} from "./canvas-object-style";

describe("canvas object color palette", () => {
  it("keeps four colors visible and the remaining palette in overflow", () => {
    expect(CANVAS_OBJECT_VISIBLE_COLORS).toEqual([
      "ink",
      "cobalt",
      "coral",
      "moss",
    ]);
    expect(CANVAS_OBJECT_OVERFLOW_COLORS).toEqual([
      "ochre",
      "saffron",
      "violet",
      "fuchsia",
    ]);
    expect([
      ...CANVAS_OBJECT_VISIBLE_COLORS,
      ...CANVAS_OBJECT_OVERFLOW_COLORS,
    ]).toEqual(CANVAS_OBJECT_COLORS);
  });

  it("uses a dedicated contrast marker token for each color", () => {
    expect(canvasObjectColorMarker("violet")).toBe(
      "var(--canvas-object-violet-marker)",
    );
  });
});
