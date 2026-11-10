import { describe, expect, it } from "vitest";

import { getCanvasWheelZoomViewport } from "./canvas-wheel-zoom";

describe("canvas wheel zoom", () => {
  it("keeps the pointer anchored to the same flow position", () => {
    const viewport = getCanvasWheelZoomViewport({
      viewport: { x: 40, y: 60, zoom: 1 },
      pointer: { x: 240, y: 160 },
      deltaY: -100,
      deltaMode: 0,
      minZoom: 0.15,
      maxZoom: 2,
    });

    expect(viewport.zoom).toBeGreaterThan(1);
    expect((240 - viewport.x) / viewport.zoom).toBeCloseTo(200);
    expect((160 - viewport.y) / viewport.zoom).toBeCloseTo(100);
  });

  it("clamps the viewport zoom to the configured bounds", () => {
    expect(
      getCanvasWheelZoomViewport({
        viewport: { x: 0, y: 0, zoom: 1.95 },
        pointer: { x: 100, y: 100 },
        deltaY: -10_000,
        deltaMode: 0,
        minZoom: 0.15,
        maxZoom: 2,
      }).zoom,
    ).toBe(2);
    expect(
      getCanvasWheelZoomViewport({
        viewport: { x: 0, y: 0, zoom: 0.2 },
        pointer: { x: 100, y: 100 },
        deltaY: 10_000,
        deltaMode: 0,
        minZoom: 0.15,
        maxZoom: 2,
      }).zoom,
    ).toBe(0.15);
  });
});
