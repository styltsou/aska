import { describe, expect, it } from "vitest";

import {
  ARROW_CORNER_RESIZE_HANDLES,
  arrowFrameResizeHandlePositions,
  arrowResizeCursor,
  makeArrowTransformFrame,
  normalizeArrowRotation,
  paddedArrowFrameBounds,
  resizeArrowPoints,
  rotateArrowPoints,
  snapArrowRotation,
} from "./canvas-arrow-transform";

describe("canvas arrow transforms", () => {
  it("exposes only corner resize controls with frame-aware native cursors", () => {
    expect(ARROW_CORNER_RESIZE_HANDLES).toEqual([
      "north-west",
      "north-east",
      "south-east",
      "south-west",
    ]);
    expect(arrowResizeCursor("north-west", 0)).toBe("cursor-nwse-resize");
    expect(arrowResizeCursor("north-east", 0)).toBe("cursor-nesw-resize");
    expect(arrowResizeCursor("north-west", Math.PI / 2)).toBe(
      "cursor-nesw-resize",
    );
    expect(arrowResizeCursor("north-east", Math.PI / 2)).toBe(
      "cursor-nwse-resize",
    );
  });

  it("keeps the default frame screen-horizontal and includes every bend", () => {
    const frame = makeArrowTransformFrame([
      { x: 10, y: 20 },
      { x: 50, y: 70 },
      { x: 110, y: 20 },
    ]);

    expect(frame.angle).toBeCloseTo(0);
    expect(frame.width).toBeCloseTo(100);
    expect(frame.height).toBeCloseTo(50);
    expect(frame.center).toEqual({ x: 60, y: 45 });
  });

  it("uses only the persisted rotation for frame orientation", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 80 },
      { x: 100, y: 100 },
    ];
    const horizontal = makeArrowTransformFrame(points);
    const rotated = makeArrowTransformFrame(points, Math.PI / 4);

    expect(horizontal.angle).toBe(0);
    expect(horizontal.axisX).toEqual({ x: 1, y: 0 });
    expect(rotated.angle).toBeCloseTo(Math.PI / 4);
    expect(rotated.axisX.x).toBeCloseTo(Math.SQRT1_2);
    expect(rotated.axisX.y).toBeCloseTo(Math.SQRT1_2);
  });

  it("uses a finite fallback frame for coincident points", () => {
    const frame = makeArrowTransformFrame([
      { x: 12, y: 18 },
      { x: 12, y: 18 },
    ]);

    expect(frame.axisX).toEqual({ x: 1, y: 0 });
    expect(frame.width).toBe(0);
    expect(frame.height).toBe(0);
    expect(
      Object.values(frame)
        .flatMap((value) =>
          typeof value === "object" ? Object.values(value) : [value],
        )
        .every(Number.isFinite),
    ).toBe(true);
  });

  it("resizes the whole path from the opposite edge", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ];
    const resized = resizeArrowPoints(
      points,
      makeArrowTransformFrame(points),
      "east",
      { x: 100, y: 0 },
      { preserveAspectRatio: false, fromCenter: false, minimumSize: 8 },
    );

    expect(resized[0]).toEqual({ x: 0, y: 0 });
    expect(resized[1]).toEqual({ x: 100, y: 40 });
    expect(resized[2]).toEqual({ x: 200, y: 0 });
  });

  it("preserves proportions and resizes around the center with modifiers", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ];
    const resized = resizeArrowPoints(
      points,
      makeArrowTransformFrame(points),
      "south-east",
      { x: 50, y: 25 },
      { preserveAspectRatio: true, fromCenter: true, minimumSize: 8 },
    );

    const center = {
      x: (resized[0]!.x + resized[1]!.x) / 2,
      y: (resized[0]!.y + resized[1]!.y) / 2,
    };
    expect(center.x).toBeCloseTo(50);
    expect(center.y).toBeCloseTo(25);
    expect(
      Math.hypot(resized[1]!.x - resized[0]!.x, resized[1]!.y - resized[0]!.y),
    ).toBeGreaterThan(Math.hypot(100, 50));
  });

  it("rotates points around the frame center and snaps to 15 degrees", () => {
    const rotated = rotateArrowPoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      { x: 5, y: 0 },
      Math.PI / 2,
    );

    expect(rotated[0]!.x).toBeCloseTo(5);
    expect(rotated[0]!.y).toBeCloseTo(-5);
    expect(rotated[1]!.x).toBeCloseTo(5);
    expect(rotated[1]!.y).toBeCloseTo(5);
    expect(snapArrowRotation(0.27)).toBeCloseTo(Math.PI / 12);
    expect(normalizeArrowRotation(Math.PI * 2)).toBe(0);
  });

  it("places resize controls outside the frame without changing frame geometry", () => {
    const frame = makeArrowTransformFrame([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    const bounds = paddedArrowFrameBounds(frame, 8, 11);
    const handles = arrowFrameResizeHandlePositions(frame, bounds, 8);

    expect(handles.west).toEqual({ x: -16, y: 0 });
    expect(handles.north).toEqual({ x: 50, y: -19 });
    expect(handles["north-west"].x).toBeLessThan(-8);
    expect(handles["north-west"].y).toBeLessThan(-11);
  });
});
