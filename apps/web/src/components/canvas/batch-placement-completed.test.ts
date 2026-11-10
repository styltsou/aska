import { describe, expect, it } from "vitest";

import {
  emitBatchPlacementCompleted,
  onBatchPlacementCompleted,
} from "./batch-placement-completed";

describe("batch placement completion", () => {
  it("notifies current listeners once and does not replay after unsubscribe", () => {
    const received: string[] = [];
    const unsubscribe = onBatchPlacementCompleted((placement) => {
      received.push(placement.boardKey);
    });

    emitBatchPlacementCompleted({
      boardKey: "workspace/collection/",
      nodeIds: ["image-1"],
      bounds: { left: 0, top: 0, right: 280, bottom: 280 },
    });
    unsubscribe();
    emitBatchPlacementCompleted({
      boardKey: "workspace/collection/",
      nodeIds: ["image-2"],
      bounds: { left: 0, top: 0, right: 280, bottom: 280 },
    });

    expect(received).toEqual(["workspace/collection/"]);
  });
});
