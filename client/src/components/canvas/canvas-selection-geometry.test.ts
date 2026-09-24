import { describe, expect, it } from "vitest";
import type { CanvasArrowObject } from "@/api/collection";
import {
  getInternalArrowIds,
  getLayoutArrowUpdates,
  getTranslatedArrowUpdates,
  type ArrowSnapshot,
} from "./canvas-selection-geometry";

const arrow: CanvasArrowObject = {
  id: "arrow-1",
  type: "arrow",
  start: {
    position: { x: 100, y: 100 },
    binding: { targetId: "note-1", anchor: { x: 1, y: 0.5 } },
  },
  end: { position: { x: 300, y: 100 } },
  points: [{ x: 200, y: 75 }],
  rotation: 0,
  routing: "smooth",
  style: "clean",
  pattern: "solid",
  head: "filled",
  color: "ink",
  createdAt: "",
  updatedAt: "",
};
const snapshot: ArrowSnapshot = {
  id: arrow.id,
  start: { x: 100, y: 100 },
  end: { x: 300, y: 100 },
  points: arrow.points,
};

describe("moving connected arrows", () => {
  it("moves a selected one-sided arrow with its selected node", () => {
    const [result] = getTranslatedArrowUpdates(
      [arrow],
      [snapshot],
      new Set(["note-1", "arrow-1"]),
      { x: 40, y: 20 },
    );
    expect(result?.start).toEqual({
      position: { x: 140, y: 120 },
      binding: arrow.start.binding,
    });
    expect(result?.end).toEqual({ position: { x: 340, y: 120 } });
    expect(result?.points).toEqual([{ x: 240, y: 95 }]);
  });

  it("detaches a selected arrow from a stationary node", () => {
    const [result] = getTranslatedArrowUpdates(
      [arrow],
      [snapshot],
      new Set(["arrow-1"]),
      { x: 40, y: 20 },
    );
    expect(result?.start).toEqual({ position: { x: 140, y: 120 } });
  });

  it("moves an unselected arrow only when both bound targets move between folders", () => {
    const internal = {
      ...arrow,
      end: {
        position: { x: 300, y: 100 },
        binding: { targetId: "text-2", anchor: { x: 0, y: 0.5 } },
      },
    };
    expect(
      getInternalArrowIds([internal], new Set(["note-1", "text-2"])),
    ).toEqual(["arrow-1"]);
    expect(getInternalArrowIds([internal], new Set(["note-1"]))).toEqual([]);
  });

  it("adapts bends when a layout moves one endpoint", () => {
    const [result] = getLayoutArrowUpdates(
      [arrow],
      [snapshot],
      new Map([["note-1", { x: 40, y: 20 }]]),
    );
    expect(result?.start.position).toEqual({ x: 140, y: 120 });
    expect(result?.end.position).toEqual({ x: 300, y: 100 });
    expect(result?.points).toEqual([{ x: 220, y: 85 }]);
  });
});
