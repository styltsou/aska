import type { Viewport, XYPosition } from "@xyflow/react";

export function getCanvasWheelZoomViewport({
  viewport,
  pointer,
  deltaY,
  deltaMode,
  minZoom,
  maxZoom,
  pinchBoost = 1,
}: {
  viewport: Viewport;
  pointer: XYPosition;
  deltaY: number;
  deltaMode: number;
  minZoom: number;
  maxZoom: number;
  pinchBoost?: number;
}): Viewport {
  const delta =
    -deltaY *
    (deltaMode === 1 ? 0.05 : deltaMode === 0 ? 0.002 : 1) *
    pinchBoost;
  const zoom = clamp(viewport.zoom * 2 ** delta, minZoom, maxZoom);
  const ratio = zoom / viewport.zoom;

  return {
    x: pointer.x - (pointer.x - viewport.x) * ratio,
    y: pointer.y - (pointer.y - viewport.y) * ratio,
    zoom,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
