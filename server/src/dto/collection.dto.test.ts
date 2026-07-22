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
  MoveCollectionNodeParentSchema,
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

  it("requires an expected parent and a folder move target", () => {
    expect(
      UpdateNodePositionSchema.safeParse({ position: { x: 48, y: 24 } })
        .success,
    ).toBe(false);
    expect(
      MoveCollectionNodeParentSchema.safeParse({
        targetFolderNodeId: "folder-7",
        expectedParentFolderNodeId: null,
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
      MoveCollectionNodeParentSchema.safeParse({
        targetFolderNodeId: "note-7",
        expectedParentFolderNodeId: "folder-3",
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
