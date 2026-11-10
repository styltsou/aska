import { describe, expect, it } from "vitest";

import {
  consumeCanvasCardEntranceSuppression,
  resolveCanvasCardPresence,
  suppressNextCanvasCardEntrance,
} from "./canvas-card-entrance";

describe("canvas card entrance suppression", () => {
  it("does not replay an active entrance when an optimistic card gets its saved id", () => {
    expect(
      resolveCanvasCardPresence({
        currentNodeId: "note-optimistic-1",
        nextNodeId: "note-42",
        currentPresence: "entering",
        isNew: false,
        entranceSuppressed: false,
      }),
    ).toBeUndefined();
  });

  it("keeps the current presence when a node keeps the same id", () => {
    expect(
      resolveCanvasCardPresence({
        currentNodeId: "note-42",
        nextNodeId: "note-42",
        currentPresence: "entering",
        isNew: false,
        entranceSuppressed: false,
      }),
    ).toBe("entering");
  });

  it("suppresses only the next entrance for a matching optimistic identity", () => {
    suppressNextCanvasCardEntrance("image-importing-dragged");

    expect(
      consumeCanvasCardEntranceSuppression("image-importing-imported"),
    ).toBe(false);
    expect(
      consumeCanvasCardEntranceSuppression("image-importing-dragged"),
    ).toBe(true);
    expect(
      consumeCanvasCardEntranceSuppression("image-importing-dragged"),
    ).toBe(false);
  });
});
