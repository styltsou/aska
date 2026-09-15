import { describe, expect, it } from "vitest";

import type { CollectionContentsResponse } from "./types";
import { updateFrontIndexesInContents } from "./canvas-object-hooks";

const contents: CollectionContentsResponse = {
  collection: { id: 1, name: "Ideas", slug: "ideas" },
  breadcrumbs: [],
  nodes: [
    {
      id: "note-1",
      type: "note",
      content: "Card",
      isFavorite: false,
      wordCount: 1,
      readingTimeMinutes: 1,
      createdAt: "2026-09-15T00:00:00.000Z",
      position: { x: 0, y: 0 },
      frontIndex: null,
    },
  ],
  canvasObjects: [
    {
      id: "text-2",
      type: "text",
      content: "Label",
      position: { x: 10, y: 10 },
      font: "inter",
      size: "md",
      color: "ink",
      frontIndex: null,
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    },
    {
      id: "arrow-3",
      type: "arrow",
      start: { position: { x: 0, y: 0 } },
      end: { position: { x: 20, y: 20 } },
      style: "clean",
      pattern: "solid",
      head: "filled",
      routing: "straight",
      points: [],
      color: "ink",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    },
  ],
};

describe("canvas front-index cache updates", () => {
  it("updates collection nodes and text while leaving arrows untouched", () => {
    const updated = updateFrontIndexesInContents(contents, [
      { id: "note-1", frontIndex: 4 },
      { id: "text-2", frontIndex: 5 },
      { id: "arrow-3", frontIndex: 6 },
    ]);

    expect(updated?.nodes[0]?.frontIndex).toBe(4);
    expect(updated?.canvasObjects[0]).toMatchObject({ frontIndex: 5 });
    expect(updated?.canvasObjects[1]).toBe(contents.canvasObjects[1]);
  });
});
