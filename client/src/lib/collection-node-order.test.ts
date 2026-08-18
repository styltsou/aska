import { describe, expect, it } from "vitest";

import type { CollectionNode } from "@/api/collection";

import { sortCollectionNodesByMostRecent } from "./collection-node-order";

function node(id: string, createdAt: string): CollectionNode {
  return {
    id,
    type: "note",
    content: id,
    color: null,
    isFavorite: false,
    wordCount: 1,
    readingTimeMinutes: 1,
    createdAt,
    position: null,
  };
}

describe("sortCollectionNodesByMostRecent", () => {
  it("orders nodes newest first without mutating the source", () => {
    const oldest = node("oldest", "2026-01-01T00:00:00.000Z");
    const newest = node("newest", "2026-03-01T00:00:00.000Z");
    const middle = node("middle", "2026-02-01T00:00:00.000Z");
    const source = [oldest, newest, middle];

    expect(sortCollectionNodesByMostRecent(source).map(({ id }) => id)).toEqual(
      ["newest", "middle", "oldest"],
    );
    expect(source).toEqual([oldest, newest, middle]);
  });

  it("keeps batch-created nodes stable when timestamps match", () => {
    const createdAt = "2026-03-01T00:00:00.000Z";
    const source = [node("first", createdAt), node("second", createdAt)];

    expect(sortCollectionNodesByMostRecent(source).map(({ id }) => id)).toEqual(
      ["first", "second"],
    );
  });
});
