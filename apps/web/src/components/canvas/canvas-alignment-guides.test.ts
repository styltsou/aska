import { describe, expect, it } from "vitest";

import {
  getCanvasAlignmentBounds,
  getCanvasAlignmentSnap,
  getVisibleCanvasAlignmentRects,
  type CanvasAlignmentRect,
} from "./canvas-alignment-guides";

const moving: CanvasAlignmentRect = {
  id: "moving",
  x: 100,
  y: 100,
  width: 100,
  height: 80,
};

describe("canvas alignment guides", () => {
  it("draws local segments between nearby aligned card boundaries", () => {
    const snap = getCanvasAlignmentSnap({
      moving,
      candidates: [
        { id: "above", x: 105, y: 0, width: 120, height: 60 },
        { id: "right", x: 240, y: 104, width: 100, height: 80 },
      ],
      zoom: 1,
    });

    expect(snap).toEqual({
      offset: { x: 5, y: 4 },
      guides: {
        vertical: { coordinate: 105, start: 60, end: 104 },
        horizontal: { coordinate: 104, start: 205, end: 240 },
      },
    });
  });

  it("aligns centres without drawing through either card", () => {
    const snap = getCanvasAlignmentSnap({
      moving,
      candidates: [
        { id: "above", x: 90, y: 0, width: 120, height: 60 },
        { id: "right", x: 240, y: 90, width: 100, height: 100 },
      ],
      zoom: 1,
    });

    expect(snap).toEqual({
      offset: { x: 0, y: 0 },
      guides: {
        vertical: { coordinate: 150, start: 60, end: 100 },
        horizontal: { coordinate: 140, start: 200, end: 240 },
      },
    });
  });

  it("does not treat opposing card edges as alignment anchors", () => {
    expect(
      getCanvasAlignmentSnap({
        moving,
        candidates: [
          { id: "above-right", x: 207, y: 0, width: 100, height: 60 },
        ],
        zoom: 1,
      }),
    ).toBeUndefined();
  });

  it("uses a screen-pixel alignment threshold across zoom levels", () => {
    const candidates = [{ id: "above", x: 107, y: 0, width: 100, height: 60 }];

    expect(
      getCanvasAlignmentSnap({ moving, candidates, zoom: 1 })?.offset.x,
    ).toBe(7);
    expect(
      getCanvasAlignmentSnap({ moving, candidates, zoom: 2 }),
    ).toBeUndefined();
  });

  it("allows alignment across the full candidate area", () => {
    expect(
      getCanvasAlignmentSnap({
        moving,
        candidates: [
          { id: "far-above", x: 100, y: -260, width: 100, height: 80 },
        ],
        zoom: 1,
      }),
    ).toEqual({
      offset: { x: 0, y: 0 },
      guides: {
        vertical: { coordinate: 100, start: -180, end: 100 },
        horizontal: undefined,
      },
    });
  });

  it("keeps only cards intersecting the current viewport", () => {
    const rectangles = getVisibleCanvasAlignmentRects(
      [
        { id: "inside", x: 40, y: 60, width: 100, height: 80 },
        { id: "partial", x: 480, y: 350, width: 100, height: 80 },
        { id: "outside", x: 520, y: 60, width: 100, height: 80 },
      ],
      { left: 0, top: 0, right: 500, bottom: 400 },
    );

    expect(rectangles.map((rectangle) => rectangle.id)).toEqual([
      "inside",
      "partial",
    ]);
  });

  it("prefers the nearest spatial neighbour", () => {
    const snap = getCanvasAlignmentSnap({
      moving,
      candidates: [
        { id: "near-above", x: 106, y: 0, width: 100, height: 60 },
        { id: "far-below", x: 100, y: 300, width: 100, height: 80 },
      ],
      zoom: 1,
    });

    expect(snap?.offset.x).toBe(6);
    expect(snap?.guides.vertical).toEqual({
      coordinate: 106,
      start: 60,
      end: 100,
    });
  });

  it("uses a multi-card selection's enclosing bounds", () => {
    const bounds = getCanvasAlignmentBounds([
      { id: "one", x: 10, y: 20, width: 50, height: 80 },
      { id: "two", x: 150, y: 60, width: 50, height: 40 },
    ]);
    const snap = getCanvasAlignmentSnap({
      moving: bounds!,
      candidates: [{ id: "above", x: 13, y: -40, width: 190, height: 20 }],
      zoom: 1,
    });

    expect(bounds).toMatchObject({ x: 10, y: 20, width: 190, height: 80 });
    expect(snap?.offset).toEqual({ x: 3, y: 0 });
    expect(snap?.guides.vertical).toEqual({
      coordinate: 13,
      start: -20,
      end: 20,
    });
  });
});
