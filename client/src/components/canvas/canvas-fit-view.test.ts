import { getViewportForBounds } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  CANVAS_FIT_VIEW_PADDING,
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
} from "./canvas-viewport";

const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 900;

describe("canvas fit view", () => {
  it("keeps a fixed edge inset when the content fits", () => {
    const bounds = { x: 100, y: 80, width: 904, height: 280 };
    const viewport = getViewportForBounds(
      bounds,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      CANVAS_MIN_ZOOM,
      CANVAS_MAX_ZOOM,
      CANVAS_FIT_VIEW_PADDING,
    );
    const left = viewport.x + bounds.x * viewport.zoom;
    const right = viewport.x + (bounds.x + bounds.width) * viewport.zoom;

    expect(left).toBeCloseTo(24);
    expect(CANVAS_WIDTH - right).toBeCloseTo(24);
  });

  it("uses the canvas maximum zoom for compact content", () => {
    const viewport = getViewportForBounds(
      { x: 0, y: 0, width: 100, height: 100 },
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      CANVAS_MIN_ZOOM,
      CANVAS_MAX_ZOOM,
      CANVAS_FIT_VIEW_PADDING,
    );

    expect(viewport.zoom).toBe(CANVAS_MAX_ZOOM);
  });
});
