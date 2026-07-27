import { describe, expect, it } from "vitest";

import {
  getBoardDropPlacement,
  getBoardPastePlacement,
  setBoardFlowPositionConverter,
  setBoardPointerPosition,
} from "./board-pointer-position";

const visibleBounds = { left: 20, top: 40, right: 980, bottom: 760 };

describe("board event placement", () => {
  it("uses the actual drop event coordinate instead of a remembered pointer", () => {
    const boardKey = "drop-position";
    setBoardPointerPosition(boardKey, { x: 900, y: 700 });
    const clearConverter = setBoardFlowPositionConverter(
      boardKey,
      ({ x, y }) => ({ x: x - 100.4, y: y + 20.6 }),
    );

    expect(
      getBoardDropPlacement(boardKey, { x: 420.8, y: 125.2 }, visibleBounds),
    ).toEqual({ position: { x: 320, y: 146 } });

    clearConverter();
  });

  it("uses the last pointer observed on the canvas for paste", () => {
    const boardKey = "paste-position";
    setBoardPointerPosition(boardKey, { x: -120, y: 340 });

    expect(getBoardPastePlacement(boardKey, visibleBounds)).toEqual({
      position: { x: -120, y: 340 },
      visibleBounds,
    });
  });

  it("does not invent a paste placement without pointer or viewport context", () => {
    expect(getBoardPastePlacement("paste-without-context", undefined)).toBe(
      undefined,
    );
  });

  it("does not fall back to a stale pointer when a drop converter is unavailable", () => {
    const boardKey = "drop-without-converter";
    setBoardPointerPosition(boardKey, { x: 900, y: 700 });

    expect(
      getBoardDropPlacement(boardKey, { x: 420, y: 125 }, visibleBounds),
    ).toEqual({ visibleBounds });
  });

  it("does not let an older canvas cleanup remove a newer converter", () => {
    const boardKey = "replaced-converter";
    const clearOldConverter = setBoardFlowPositionConverter(boardKey, () => ({
      x: 1,
      y: 1,
    }));
    const clearNewConverter = setBoardFlowPositionConverter(boardKey, () => ({
      x: 2,
      y: 2,
    }));

    clearOldConverter();

    expect(
      getBoardDropPlacement(boardKey, { x: 0, y: 0 }, visibleBounds),
    ).toEqual({ position: { x: 2, y: 2 } });

    clearNewConverter();
  });
});
