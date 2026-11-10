import { describe, expect, it } from "vitest";

import {
  ARROW_Z_INDEX,
  MAX_FRONT_INDEX,
  OVERLAY_Z_INDEX,
  RESTING_CARD_Z_INDEX,
  RESTING_TEXT_Z_INDEX,
  getCanvasFrontZIndex,
  getCanvasInteractionZIndex,
  getCanvasRestingZIndex,
  promoteCanvasFrontIndexes,
  renumberFrontIndexes,
  updateExpandedNoteOrder,
} from "./canvas-node-stacking";

const note = (id: string, isExpanded = false) => ({
  id,
  type: "note",
  isExpanded,
});

describe("canvas node stacking", () => {
  it("places every expanded note above resting cards", () => {
    const nodes = [
      note("note-1", true),
      note("note-2"),
      { id: "image-1", type: "image" },
    ];
    const order = updateExpandedNoteOrder([], nodes);

    expect(getCanvasRestingZIndex(nodes[0]!, order)).toBeGreaterThan(
      getCanvasRestingZIndex(nodes[1]!, order),
    );
    expect(getCanvasRestingZIndex(nodes[0]!, order)).toBeGreaterThan(
      getCanvasRestingZIndex(nodes[2]!, order),
    );
  });

  it("moves a newly expanded note above notes that were already expanded", () => {
    const initiallyExpanded = [note("note-1", true), note("note-2", true)];
    const initialOrder = updateExpandedNoteOrder([], initiallyExpanded);
    const collapsedOrder = updateExpandedNoteOrder(initialOrder, [
      note("note-1"),
      note("note-2", true),
    ]);
    const expandedOrder = updateExpandedNoteOrder(collapsedOrder, [
      note("note-1", true),
      note("note-2", true),
    ]);

    expect(expandedOrder).toEqual(["note-2", "note-1"]);
    expect(
      getCanvasRestingZIndex(note("note-1", true), expandedOrder),
    ).toBeGreaterThan(
      getCanvasRestingZIndex(note("note-2", true), expandedOrder),
    );
  });

  it("keeps drag and drop-stack layers above expanded notes", () => {
    const order = updateExpandedNoteOrder([], [note("note-1", true)]);

    expect(getCanvasInteractionZIndex()).toBeGreaterThan(
      getCanvasRestingZIndex(note("note-1", true), order),
    );
    expect(getCanvasInteractionZIndex(2)).toBeGreaterThan(
      getCanvasInteractionZIndex(),
    );
  });

  it("removes collapsed or deleted notes from the stacking order", () => {
    const order = updateExpandedNoteOrder(
      ["note-1", "note-2"],
      [note("note-1"), { id: "image-1", type: "image" }],
    );

    expect(order).toEqual([]);
  });

  it("keeps every visual band in the intended order", () => {
    const order = updateExpandedNoteOrder([], [note("note-1", true)]);
    const expanded = getCanvasRestingZIndex(note("note-1", true), order);
    const front = getCanvasFrontZIndex(0);

    expect(RESTING_TEXT_Z_INDEX).toBeGreaterThan(RESTING_CARD_Z_INDEX);
    expect(front).toBeGreaterThan(expanded);
    expect(ARROW_Z_INDEX).toBeGreaterThan(
      getCanvasFrontZIndex(MAX_FRONT_INDEX),
    );
    expect(OVERLAY_Z_INDEX).toBeGreaterThan(ARROW_Z_INDEX);
    expect(getCanvasInteractionZIndex()).toBeGreaterThan(OVERLAY_Z_INDEX);
  });

  it("uses persisted front order for collapsed and expanded nodes", () => {
    const order = ["expanded"];

    expect(getCanvasRestingZIndex(note("collapsed"), order, 4)).toBe(
      getCanvasFrontZIndex(4),
    );
    expect(getCanvasRestingZIndex(note("expanded", true), order, 5)).toBe(
      getCanvasFrontZIndex(5),
    );
  });

  it("renumbers front indexes without changing relative order", () => {
    const result = renumberFrontIndexes(
      new Map([
        ["middle", 50],
        ["back", 10],
        ["front", 90],
      ]),
    );

    expect([...result.indexes.entries()]).toEqual([
      ["back", 0],
      ["middle", 1],
      ["front", 2],
    ]);
    expect(result.next).toBe(3);
  });

  it("promotes a group in bottom-to-top order", () => {
    const result = promoteCanvasFrontIndexes(
      new Map([
        ["primary", 1],
        ["other", 8],
      ]),
      ["secondary", "primary"],
    );

    expect(result.get("secondary")).toBe(9);
    expect(result.get("primary")).toBe(10);
  });
});
