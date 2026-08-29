import { describe, expect, it } from "vitest";

import {
  getCanvasInteractionZIndex,
  getCanvasRestingZIndex,
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
});
