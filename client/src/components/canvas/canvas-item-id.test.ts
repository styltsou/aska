import { describe, expect, it } from "vitest";

import {
  isPersistedCanvasItemId,
  isPersistedCollectionNodeId,
} from "./canvas-item-id";

describe("canvas item IDs", () => {
  it("allows persisted videos in canvas move operations", () => {
    expect(isPersistedCanvasItemId("video-12")).toBe(true);
    expect(isPersistedCollectionNodeId("video-12")).toBe(true);
  });

  it("allows mixed persisted asset selections while excluding transient IDs", () => {
    const selectedIds = ["video-12", "image-4", "note-8"];

    expect(selectedIds.every(isPersistedCanvasItemId)).toBe(true);
    expect(selectedIds.every(isPersistedCollectionNodeId)).toBe(true);
    expect(isPersistedCanvasItemId("video-pending")).toBe(false);
  });

  it("keeps canvas-only objects out of collection-node geometry updates", () => {
    expect(isPersistedCanvasItemId("arrow-2")).toBe(true);
    expect(isPersistedCollectionNodeId("arrow-2")).toBe(false);
    expect(isPersistedCollectionNodeId("text-2")).toBe(false);
  });
});
