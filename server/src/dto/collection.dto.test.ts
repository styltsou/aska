import { describe, expect, it } from "vitest";

import {
  BoardPositionSchema,
  CollectionNodePathParamSchema,
  CreateFolderSchema,
  CreateNoteSchema,
  AssetPathParamSchema,
  CollectionAssetNodePathParamSchema,
  CollectionContentsQuerySchema,
  UpdateNodePositionSchema,
  UpdateNodePositionsSchema,
  UpdateNoteSchema,
  UpdateImageSchema,
  MoveCollectionNodesParentSchema,
} from "./collection.dto";

describe("collection board position DTOs", () => {
  it("accepts signed integer canvas coordinates", () => {
    expect(BoardPositionSchema.parse({ x: -48, y: 96 })).toEqual({
      x: -48,
      y: 96,
    });
  });

  it("rejects fractional and out-of-range coordinates", () => {
    expect(BoardPositionSchema.safeParse({ x: 24.5, y: 0 }).success).toBe(
      false,
    );
    expect(
      BoardPositionSchema.safeParse({ x: 2_147_483_648, y: 0 }).success,
    ).toBe(false);
  });

  it("carries optional positions through collection creation inputs", () => {
    expect(
      CreateFolderSchema.parse({
        name: "References",
        position: { x: 0, y: 24 },
      }).position,
    ).toEqual({ x: 0, y: 24 });
    expect(
      CreateNoteSchema.parse({ content: "Idea", position: { x: 72, y: 48 } })
        .position,
    ).toEqual({ x: 72, y: 48 });
  });

  it("requires non-empty bounded note updates", () => {
    expect(UpdateNoteSchema.parse({ content: "A growing idea" })).toEqual({
      content: "A growing idea",
    });
    expect(UpdateNoteSchema.safeParse({ content: "" }).success).toBe(false);
    expect(
      UpdateNoteSchema.safeParse({ content: "x".repeat(10_001) }).success,
    ).toBe(false);
  });

  it("requires a complete position update", () => {
    expect(
      UpdateNodePositionSchema.safeParse({
        position: { x: 48 },
        expectedParentFolderNodeId: null,
      }).success,
    ).toBe(false);
  });

  it("accepts unique batch positions and rejects duplicate or singleton batches", () => {
    expect(
      UpdateNodePositionsSchema.safeParse({
        positions: [
          { nodeId: "image-1", position: { x: 48, y: 24 } },
          { nodeId: "folder-2", position: { x: 144, y: 24 } },
        ],
        expectedParentFolderNodeId: null,
      }).success,
    ).toBe(true);
    expect(
      UpdateNodePositionsSchema.safeParse({
        positions: [
          { nodeId: "image-1", position: { x: 48, y: 24 } },
          { nodeId: "image-1", position: { x: 144, y: 24 } },
        ],
        expectedParentFolderNodeId: null,
      }).success,
    ).toBe(false);
    expect(
      UpdateNodePositionsSchema.safeParse({
        positions: [{ nodeId: "image-1", position: { x: 48, y: 24 } }],
        expectedParentFolderNodeId: null,
      }).success,
    ).toBe(false);
  });

  it("accepts a folder or collection-root move target", () => {
    expect(
      UpdateNodePositionSchema.safeParse({ position: { x: 48, y: 24 } })
        .success,
    ).toBe(false);
    expect(
      MoveCollectionNodesParentSchema.safeParse({
        nodeIds: ["image-1"],
        targetFolderNodeId: "folder-7",
      }).success,
    ).toBe(true);
    expect(
      CollectionNodePathParamSchema.safeParse({
        workspaceSlug: "design",
        collectionSlug: "references",
        nodeId: "folder-7",
      }).success,
    ).toBe(true);
    expect(
      MoveCollectionNodesParentSchema.safeParse({
        nodeIds: ["image-1"],
        targetFolderNodeId: "note-7",
      }).success,
    ).toBe(false);
    expect(
      CollectionAssetNodePathParamSchema.safeParse({
        workspaceSlug: "design",
        collectionSlug: "references",
        nodeId: "folder-7",
      }).success,
    ).toBe(false);
  });

  it("accepts unique mixed-node batch moves and rejects duplicates", () => {
    const move = {
      nodeIds: ["image-1", "folder-2", "note-3"],
      targetFolderNodeId: "folder-7",
    };

    expect(MoveCollectionNodesParentSchema.safeParse(move).success).toBe(true);
    expect(
      MoveCollectionNodesParentSchema.safeParse({
        ...move,
        nodeIds: ["image-1", "image-1"],
      }).success,
    ).toBe(false);
    expect(
      MoveCollectionNodesParentSchema.safeParse({
        nodeIds: ["image-1"],
        targetFolderNodeId: null,
      }).success,
    ).toBe(true);
  });

  it("validates asset and collection node identifier formats", () => {
    expect(
      AssetPathParamSchema.safeParse({
        workspaceSlug: "design",
        assetId: "image-12",
      }).success,
    ).toBe(true);
    expect(
      CollectionNodePathParamSchema.safeParse({
        workspaceSlug: "design",
        collectionSlug: "references",
        nodeId: "folder-7",
      }).success,
    ).toBe(true);
    expect(
      AssetPathParamSchema.safeParse({
        workspaceSlug: "design",
        assetId: "folder-7",
      }).success,
    ).toBe(false);
    expect(
      CollectionNodePathParamSchema.safeParse({
        workspaceSlug: "design",
        collectionSlug: "references",
        nodeId: "asset-7",
      }).success,
    ).toBe(false);
  });

  it("parses comma-separated content type filters", () => {
    expect(
      CollectionContentsQuerySchema.parse({
        folderPath: "references",
        types: "image,note",
      }),
    ).toEqual({ folderPath: "references", types: ["image", "note"] });
    expect(
      CollectionContentsQuerySchema.safeParse({ types: "video" }).success,
    ).toBe(false);
  });
});

describe("image note DTOs", () => {
  it("accepts bounded text and clearing an image note", () => {
    expect(
      UpdateImageSchema.parse({ note: "Reference for the hero image" }),
    ).toEqual({ note: "Reference for the hero image" });
    expect(UpdateImageSchema.parse({ note: null })).toEqual({ note: null });
    expect(
      UpdateImageSchema.safeParse({ note: "x".repeat(10_001) }).success,
    ).toBe(false);
  });
});
