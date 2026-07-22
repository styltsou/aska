import { describe, expect, it } from "vitest";

import { parseAssetNodeId, parseCollectionNodeId } from "./collection-node-id";

describe("collection node identifiers", () => {
  it("parses folder and asset collection node identifiers", () => {
    expect(parseCollectionNodeId("folder-7")).toEqual({
      nodeType: "folder",
      entityId: 7,
    });
    expect(parseCollectionNodeId("image-42")).toEqual({
      nodeType: "asset",
      entityId: 42,
    });
    expect(parseCollectionNodeId("note-5")).toEqual({
      nodeType: "asset",
      entityId: 5,
    });
  });

  it("parses only image and note identifiers as assets", () => {
    expect(parseAssetNodeId("image-42")).toEqual({
      assetType: "image",
      entityId: 42,
    });
    expect(parseAssetNodeId("note-5")).toEqual({
      assetType: "note",
      entityId: 5,
    });
    expect(() => parseAssetNodeId("folder-7")).toThrow("Invalid asset id");
  });

  it("rejects malformed and unsafe collection node identifiers", () => {
    for (const nodeId of [
      "asset-1",
      "folder-",
      "folder-1-extra",
      "image--1",
      "note-9007199254740992",
    ]) {
      expect(() => parseCollectionNodeId(nodeId)).toThrow("Invalid node id");
    }
  });
});
