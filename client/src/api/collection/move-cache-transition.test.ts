import { describe, expect, it } from "vitest";

import {
  appendMovedNodeToContents,
  getAssetPreview,
  promoteCollectionPreview,
  recomputeFolderPreviews,
  removeNodeFromContents,
  restoreNodeToContents,
  rollbackCollectionPreview,
  transitionCachedContentsForMove,
  updateTargetFolderForMove,
} from "./move-cache-transition";
import type {
  CollectionContentsResponse,
  CollectionNode,
  CollectionsData,
} from "./types";

const movedNote: Extract<CollectionNode, { type: "note" }> = {
  id: "note-1",
  type: "note",
  content: "Move this note",
  color: "#f0b",
  isFavorite: false,
  wordCount: 3,
  readingTimeMinutes: 1,
  position: { x: 24, y: 48 },
};

const remainingNote: Extract<CollectionNode, { type: "note" }> = {
  ...movedNote,
  id: "note-2",
  content: "Keep this note",
  position: { x: 400, y: 48 },
};

const targetFolder: Extract<CollectionNode, { type: "folder" }> = {
  id: "folder-9",
  type: "folder",
  name: "Archive",
  slug: "archive",
  count: 2,
  previews: [{ assetId: "note-7", type: "note", snippet: "Older" }],
  position: { x: 720, y: 48 },
};

const movedFolder: Extract<CollectionNode, { type: "folder" }> = {
  id: "folder-4",
  type: "folder",
  name: "New",
  slug: "new",
  count: 3,
  previews: [{ assetId: "note-8", type: "note", snippet: "Inside New" }],
  position: { x: 240, y: 48 },
};

function makeContents(nodes: CollectionNode[]): CollectionContentsResponse {
  return {
    collection: { id: 1, name: "Reference", slug: "reference" },
    breadcrumbs: [],
    nodes,
  };
}

describe("move cache transition", () => {
  it("removes the source node, updates the target card, and appends a null-position destination clone", () => {
    const source = makeContents([movedNote, remainingNote, targetFolder]);
    const removal = removeNodeFromContents(source, movedNote.id);
    const preview = getAssetPreview(movedNote);
    const movedSource = updateTargetFolderForMove(
      removal.contents,
      targetFolder.id,
      preview,
      1,
    );
    const destination = appendMovedNodeToContents(makeContents([]), movedNote);

    expect(removal.node).toEqual(movedNote);
    expect(movedSource.nodes).not.toContainEqual(movedNote);
    expect(movedSource.nodes).toContainEqual({
      ...targetFolder,
      count: 3,
      previews: [preview, ...targetFolder.previews],
    });
    expect(destination.nodes).toEqual([{ ...movedNote, position: null }]);
  });

  it("moves a folder node and adds its recursive asset count without adding an asset preview", () => {
    const source = makeContents([movedFolder, targetFolder]);
    const removal = removeNodeFromContents(source, movedFolder.id);
    const movedSource = updateTargetFolderForMove(
      removal.contents,
      targetFolder.id,
      undefined,
      movedFolder.count,
    );
    const destination = appendMovedNodeToContents(
      makeContents([]),
      movedFolder,
    );

    expect(removal.node).toEqual(movedFolder);
    expect(movedSource.nodes).not.toContainEqual(movedFolder);
    expect(movedSource.nodes).toContainEqual({
      ...targetFolder,
      count: targetFolder.count + movedFolder.count,
    });
    expect(destination.nodes).toEqual([{ ...movedFolder, position: null }]);
  });

  it("updates every compatible cached source and destination filter variant", () => {
    const root = makeContents([movedFolder, targetFolder]);
    const emptyDestination = makeContents([]);
    const rootKey = ["collectionContents", "personal", "reference", undefined];
    const rootFolderFilterKey = [
      "collectionContents",
      "personal",
      "reference",
      undefined,
      "folder",
    ];
    const targetKey = [
      "collectionContents",
      "personal",
      "reference",
      "archive",
    ];
    const targetFolderFilterKey = [...targetKey, "folder"];
    const targetNoteFilterKey = [...targetKey, "note"];

    const updates = transitionCachedContentsForMove(
      [
        [rootKey, root],
        [rootFolderFilterKey, root],
        [targetKey, emptyDestination],
        [targetFolderFilterKey, emptyDestination],
        [targetNoteFilterKey, emptyDestination],
      ],
      {
        sourceFolderPath: undefined,
        targetFolderPath: "archive",
        targetFolderNodeId: targetFolder.id,
        movedNode: movedFolder,
      },
    );
    const updateMap = new Map(
      updates.map(([key, contents]) => [JSON.stringify(key), contents]),
    );

    for (const sourceKey of [rootKey, rootFolderFilterKey]) {
      const contents = updateMap.get(JSON.stringify(sourceKey));
      expect(contents?.nodes).not.toContainEqual(movedFolder);
      expect(contents?.nodes).toContainEqual({
        ...targetFolder,
        count: targetFolder.count + movedFolder.count,
      });
    }
    for (const destinationKey of [targetKey, targetFolderFilterKey]) {
      expect(updateMap.get(JSON.stringify(destinationKey))?.nodes).toEqual([
        { ...movedFolder, position: null },
      ]);
    }
    expect(updateMap.has(JSON.stringify(targetNoteFilterKey))).toBe(false);
  });

  it("rebuilds source-folder previews from remaining children and rolls back by asset ID", () => {
    const parent = makeContents([
      {
        id: "folder-3",
        type: "folder",
        name: "Source",
        slug: "source",
        count: 2,
        previews: [getAssetPreview(movedNote)],
        position: null,
      },
    ]);
    const recomputed = recomputeFolderPreviews(parent, "source", [
      remainingNote,
    ]);
    const restored = restoreNodeToContents(
      makeContents([remainingNote, targetFolder]),
      movedNote,
      0,
    );

    expect(recomputed.nodes[0]).toMatchObject({
      previews: [getAssetPreview(remainingNote)],
    });
    expect(restored.nodes.map((node) => node.id)).toEqual([
      movedNote.id,
      remainingNote.id,
      targetFolder.id,
    ]);
  });

  it("promotes the reinserted placement preview and restores its prior slot without replacing unrelated cache data", () => {
    const collections: CollectionsData = {
      collections: [
        {
          id: 1,
          name: "Reference",
          slug: "reference",
          description: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          assetCount: 2,
          previews: [
            getAssetPreview(remainingNote),
            getAssetPreview(movedNote),
          ],
        },
      ],
    };
    const preview = getAssetPreview(movedNote);
    const promoted = promoteCollectionPreview(
      collections,
      "reference",
      preview,
    );
    const rolledBack = rollbackCollectionPreview(
      promoted,
      "reference",
      preview,
      1,
    );

    expect(
      promoted.collections[0]!.previews.map((item) => item.assetId),
    ).toEqual([movedNote.id, remainingNote.id]);
    expect(rolledBack).toEqual(collections);
  });
});
