import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  folders,
  imageAssets,
  organization,
  uploads,
  user,
} from "@/db/schema";
import { CollectionService } from "@/services/collection.service";
import { ImageUploadService } from "@/services/image-upload.service";
import type { IObjectStorageService } from "@/services/object-storage.service";

if (process.env.RUN_INTEGRATION_TESTS !== "true") {
  throw new Error(
    "Integration tests require RUN_INTEGRATION_TESTS=true and a disposable database.",
  );
}

const objectStorageService: IObjectStorageService = {
  bucket: "test-bucket",
  async createPresignedPutUrl() {
    return {
      url: "https://example.test/upload",
      headers: {},
      expiresAt: new Date(),
    };
  },
  async createPresignedGetUrl(key) {
    return { key, url: `https://example.test/${key}`, expiresAt: new Date() };
  },
  async createPresignedGetUrls(keys) {
    return new Map(
      [...keys].map((key) => [
        key,
        { key, url: `https://example.test/${key}`, expiresAt: new Date() },
      ]),
    );
  },
  async putObject() {},
  async getObjectBytes() {
    return new Uint8Array();
  },
  async deleteObject() {},
  async deleteObjects() {},
};

const collectionService = new CollectionService({ objectStorageService });
const imageUploadService = new ImageUploadService(objectStorageService);

let fixture: { organizationId: string; userId: string };

beforeEach(async () => {
  const suffix = randomUUID();
  fixture = {
    organizationId: `integration-org-${suffix}`,
    userId: `integration-user-${suffix}`,
  };

  await db.insert(user).values({
    id: fixture.userId,
    name: "Integration Test User",
    email: `${fixture.userId}@example.test`,
    emailVerified: true,
  });
  await db.insert(organization).values({
    id: fixture.organizationId,
    name: "Integration Test Organization",
    slug: `integration-${suffix}`,
    createdAt: new Date(),
  });
});

afterEach(async () => {
  await db
    .delete(organization)
    .where(eq(organization.id, fixture.organizationId));
  await db.delete(user).where(eq(user.id, fixture.userId));
});

describe("CollectionService integration", () => {
  it("flattens direct children beside the parent composition and preserves nested layouts", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Flatten Test" },
    );
    const existingNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "Existing parent item", position: { x: 100, y: 200 } },
    );
    const sourceFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Source", position: { x: 800, y: 500 } },
    );
    const directNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        content: "Move with the group",
        parentFolderPath: sourceFolder.slug,
        position: { x: 20, y: 30 },
      },
    );
    const nestedFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        name: "Nested",
        parentFolderPath: sourceFolder.slug,
        position: { x: 360, y: 80 },
      },
    );
    const nestedNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        content: "Stay inside the nested folder",
        parentFolderPath: `${sourceFolder.slug}/${nestedFolder.slug}`,
        position: { x: 70, y: 90 },
      },
    );

    await expect(
      collectionService.flattenFolder(
        fixture.organizationId,
        collection.slug,
        `folder-${sourceFolder.id}`,
      ),
    ).resolves.toEqual({
      folderNodeId: `folder-${sourceFolder.id}`,
      parentFolderNodeId: null,
      directChildCount: 2,
      position: { x: 412, y: 200 },
    });

    const [rootContents, nestedContents, directPlacement, nestedPlacement] =
      await Promise.all([
        collectionService.getCollectionContents(
          fixture.organizationId,
          collection.slug,
        ),
        collectionService.getCollectionContents(
          fixture.organizationId,
          collection.slug,
          nestedFolder.slug,
        ),
        db
          .select({
            parentFolderId: collectionNodes.parentFolderId,
            positionX: collectionNodes.positionX,
            positionY: collectionNodes.positionY,
            pathFolderSlugs: collectionNodes.pathFolderSlugs,
            depth: collectionNodes.depth,
          })
          .from(collectionNodes)
          .where(eq(collectionNodes.assetId, Number(directNote.id.slice(5)))),
        db
          .select({
            parentFolderId: collectionNodes.parentFolderId,
            positionX: collectionNodes.positionX,
            positionY: collectionNodes.positionY,
            pathFolderSlugs: collectionNodes.pathFolderSlugs,
            depth: collectionNodes.depth,
          })
          .from(collectionNodes)
          .where(eq(collectionNodes.assetId, Number(nestedNote.id.slice(5)))),
      ]);

    expect(rootContents.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: existingNote.id }),
        expect.objectContaining({
          id: directNote.id,
          position: { x: 412, y: 200 },
        }),
        expect.objectContaining({
          id: `folder-${nestedFolder.id}`,
          position: { x: 752, y: 250 },
        }),
      ]),
    );
    expect(rootContents.nodes).not.toContainEqual(
      expect.objectContaining({ id: `folder-${sourceFolder.id}` }),
    );
    expect(nestedContents.nodes).toEqual([
      expect.objectContaining({
        id: nestedNote.id,
        position: { x: 70, y: 90 },
      }),
    ]);
    expect(directPlacement).toEqual([
      {
        parentFolderId: null,
        positionX: 412,
        positionY: 200,
        pathFolderSlugs: [],
        depth: 0,
      },
    ]);
    expect(nestedPlacement).toEqual([
      {
        parentFolderId: nestedFolder.id,
        positionX: 70,
        positionY: 90,
        pathFolderSlugs: [nestedFolder.slug],
        depth: 1,
      },
    ]);
  });

  it("moves a persisted asset into a child folder and rejects a stale position write", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Move Test" },
    );
    const targetFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Archive" },
    );
    const note = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "Move this note", position: { x: 144, y: 96 } },
    );

    await expect(
      collectionService.moveNodeToFolder(
        fixture.organizationId,
        collection.slug,
        note.id,
        {
          targetFolderNodeId: `folder-${targetFolder.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).resolves.toMatchObject({
      nodeId: note.id,
      sourceParentFolderNodeId: null,
      targetParentFolderNodeId: `folder-${targetFolder.id}`,
      targetFolderPath: targetFolder.slug,
      position: { x: 48, y: 48 },
      moved: true,
    });

    const [rootContents, targetContents, placement] = await Promise.all([
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
      ),
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        targetFolder.slug,
      ),
      db
        .select({
          parentFolderId: collectionNodes.parentFolderId,
          pathFolderSlugs: collectionNodes.pathFolderSlugs,
          depth: collectionNodes.depth,
          positionX: collectionNodes.positionX,
          positionY: collectionNodes.positionY,
        })
        .from(collectionNodes)
        .where(
          eq(collectionNodes.assetId, Number(note.id.slice("note-".length))),
        )
        .limit(1),
    ]);

    expect(rootContents.nodes).toContainEqual(
      expect.objectContaining({ id: `folder-${targetFolder.id}`, count: 1 }),
    );
    expect(rootContents.nodes.some((node) => node.id === note.id)).toBe(false);
    expect(targetContents.nodes).toContainEqual(
      expect.objectContaining({ id: note.id, position: { x: 48, y: 48 } }),
    );
    expect(placement).toEqual([
      {
        parentFolderId: targetFolder.id,
        pathFolderSlugs: [targetFolder.slug],
        depth: 1,
        positionX: 48,
        positionY: 48,
      },
    ]);

    await expect(
      collectionService.updateNodePosition(
        fixture.organizationId,
        collection.slug,
        note.id,
        {
          position: { x: 144, y: 96 },
          expectedParentFolderNodeId: null,
        },
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    await expect(
      collectionService.moveNodeToFolder(
        fixture.organizationId,
        collection.slug,
        note.id,
        {
          targetFolderNodeId: `folder-${targetFolder.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).resolves.toMatchObject({ moved: false });
  });

  it("places a moved asset in a collision-free destination composition slot", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Composition Move Test" },
    );
    const targetFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Archive" },
    );
    const destinationPositions = [
      { x: 0, y: 0 },
      { x: 624, y: 0 },
      { x: 0, y: 624 },
      { x: 624, y: 624 },
    ];
    for (const [index, position] of destinationPositions.entries()) {
      await collectionService.createFolder(
        fixture.organizationId,
        fixture.userId,
        collection.slug,
        {
          name: `Destination ${index + 1}`,
          parentFolderPath: targetFolder.slug,
          position,
        },
      );
    }
    const note = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "Move into the composition", position: { x: 40, y: 40 } },
    );

    await expect(
      collectionService.moveNodeToFolder(
        fixture.organizationId,
        collection.slug,
        note.id,
        {
          targetFolderNodeId: `folder-${targetFolder.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).resolves.toMatchObject({
      position: { x: 312, y: 292 },
      moved: true,
    });

    const destinationContents = await collectionService.getCollectionContents(
      fixture.organizationId,
      collection.slug,
      targetFolder.slug,
    );
    expect(destinationContents.nodes).toContainEqual(
      expect.objectContaining({ id: note.id, position: { x: 312, y: 292 } }),
    );
  });

  it("atomically moves a mixed asset-and-folder batch", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Mixed Batch Move Test" },
    );
    const targetFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Archive" },
    );
    const movedFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "References" },
    );
    const nestedNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        content: "Keep this nested",
        parentFolderPath: movedFolder.slug,
      },
    );
    const movedNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "Move beside the folder" },
    );

    await expect(
      collectionService.moveNodesToFolder(
        fixture.organizationId,
        collection.slug,
        {
          nodeIds: [movedNote.id, `folder-${movedFolder.id}`],
          targetFolderNodeId: `folder-${targetFolder.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).resolves.toMatchObject({
      moves: [
        { nodeId: movedNote.id, moved: true },
        { nodeId: `folder-${movedFolder.id}`, moved: true },
      ],
    });

    const targetContents = await collectionService.getCollectionContents(
      fixture.organizationId,
      collection.slug,
      targetFolder.slug,
    );
    expect(targetContents.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: movedNote.id }),
        expect.objectContaining({ id: `folder-${movedFolder.id}`, count: 1 }),
      ]),
    );
    const targetPositions = targetContents.nodes.map((node) =>
      JSON.stringify(node.position),
    );
    expect(new Set(targetPositions).size).toBe(targetPositions.length);
    await expect(
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        `${targetFolder.slug}/${movedFolder.slug}`,
      ),
    ).resolves.toMatchObject({
      nodes: [expect.objectContaining({ id: nestedNote.id })],
    });
  });

  it("rolls back earlier batch moves when a later node has a stale parent", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Batch Stale Parent Test" },
    );
    const sourceFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Source" },
    );
    const targetFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Target" },
    );
    const rootNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "This valid first move must roll back" },
    );
    const nestedNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        content: "This node has a different parent",
        parentFolderPath: sourceFolder.slug,
      },
    );

    await expect(
      collectionService.moveNodesToFolder(
        fixture.organizationId,
        collection.slug,
        {
          nodeIds: [rootNote.id, nestedNote.id],
          targetFolderNodeId: `folder-${targetFolder.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    const [rootContents, sourceContents, targetContents] = await Promise.all([
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
      ),
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        sourceFolder.slug,
      ),
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        targetFolder.slug,
      ),
    ]);
    expect(rootContents.nodes).toContainEqual(
      expect.objectContaining({ id: rootNote.id }),
    );
    expect(sourceContents.nodes).toContainEqual(
      expect.objectContaining({ id: nestedNote.id }),
    );
    expect(targetContents.nodes).toEqual([]);
  });

  it("rolls back earlier batch moves when a selected folder would create a cycle", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Batch Folder Cycle Test" },
    );
    const sourceFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Source" },
    );
    const descendantFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        name: "Descendant",
        parentFolderPath: sourceFolder.slug,
      },
    );
    const rootNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "This earlier move must roll back" },
    );

    await expect(
      collectionService.moveNodesToFolder(
        fixture.organizationId,
        collection.slug,
        {
          nodeIds: [rootNote.id, `folder-${sourceFolder.id}`],
          targetFolderNodeId: `folder-${descendantFolder.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).rejects.toMatchObject({ code: "validation_error" });

    const [rootContents, descendantContents] = await Promise.all([
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
      ),
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        `${sourceFolder.slug}/${descendantFolder.slug}`,
      ),
    ]);
    expect(rootContents.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rootNote.id }),
        expect.objectContaining({ id: `folder-${sourceFolder.id}` }),
      ]),
    );
    expect(descendantContents.nodes).toEqual([]);
  });

  it("moves a folder subtree without unplacing its assets or corrupting its path", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Folder Move Test" },
    );
    const targetFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Test" },
    );
    const movedFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "New", position: { x: 48, y: 72 } },
    );
    const directNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        content: "Keep this note in New",
        parentFolderPath: movedFolder.slug,
        position: { x: 144, y: 96 },
      },
    );
    const nestedFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        name: "Nested",
        parentFolderPath: movedFolder.slug,
        position: { x: 336, y: 72 },
      },
    );
    const nestedNote = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        content: "Keep this nested note too",
        parentFolderPath: `${movedFolder.slug}/${nestedFolder.slug}`,
        position: { x: 480, y: 120 },
      },
    );

    await expect(
      collectionService.moveNodeToFolder(
        fixture.organizationId,
        collection.slug,
        `folder-${movedFolder.id}`,
        {
          targetFolderNodeId: `folder-${targetFolder.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).resolves.toMatchObject({
      nodeId: `folder-${movedFolder.id}`,
      sourceParentFolderNodeId: null,
      targetParentFolderNodeId: `folder-${targetFolder.id}`,
      targetFolderPath: targetFolder.slug,
      position: { x: 48, y: 48 },
      moved: true,
    });

    const movedPath = `${targetFolder.slug}/${movedFolder.slug}`;
    const nestedPath = `${movedPath}/${nestedFolder.slug}`;
    const [rootContents, targetContents, movedContents, nestedContents] =
      await Promise.all([
        collectionService.getCollectionContents(
          fixture.organizationId,
          collection.slug,
        ),
        collectionService.getCollectionContents(
          fixture.organizationId,
          collection.slug,
          targetFolder.slug,
        ),
        collectionService.getCollectionContents(
          fixture.organizationId,
          collection.slug,
          movedPath,
        ),
        collectionService.getCollectionContents(
          fixture.organizationId,
          collection.slug,
          nestedPath,
        ),
      ]);

    expect(rootContents.nodes).not.toContainEqual(
      expect.objectContaining({ id: `folder-${movedFolder.id}` }),
    );
    expect(rootContents.nodes).toContainEqual(
      expect.objectContaining({ id: `folder-${targetFolder.id}`, count: 2 }),
    );
    expect(targetContents.nodes).toContainEqual(
      expect.objectContaining({ id: `folder-${movedFolder.id}`, count: 2 }),
    );
    expect(movedContents.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: directNote.id,
          position: { x: 144, y: 96 },
        }),
        expect.objectContaining({
          id: `folder-${nestedFolder.id}`,
          position: { x: 336, y: 72 },
        }),
      ]),
    );
    expect(nestedContents.nodes).toContainEqual(
      expect.objectContaining({
        id: nestedNote.id,
        position: { x: 480, y: 120 },
      }),
    );

    const placements = await db
      .select({
        assetId: collectionNodes.assetId,
        folderId: collectionNodes.folderId,
        parentFolderId: collectionNodes.parentFolderId,
        depth: collectionNodes.depth,
        pathFolderIds: collectionNodes.pathFolderIds,
        pathFolderSlugs: collectionNodes.pathFolderSlugs,
      })
      .from(collectionNodes)
      .where(eq(collectionNodes.collectionId, collection.id));

    expect(placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          folderId: movedFolder.id,
          parentFolderId: targetFolder.id,
          depth: 1,
          pathFolderIds: [targetFolder.id, movedFolder.id],
          pathFolderSlugs: [targetFolder.slug, movedFolder.slug],
        }),
        expect.objectContaining({
          assetId: Number(directNote.id.slice("note-".length)),
          parentFolderId: movedFolder.id,
          depth: 2,
          pathFolderIds: [targetFolder.id, movedFolder.id],
          pathFolderSlugs: [targetFolder.slug, movedFolder.slug],
        }),
        expect.objectContaining({
          folderId: nestedFolder.id,
          parentFolderId: movedFolder.id,
          depth: 2,
          pathFolderIds: [targetFolder.id, movedFolder.id, nestedFolder.id],
          pathFolderSlugs: [
            targetFolder.slug,
            movedFolder.slug,
            nestedFolder.slug,
          ],
        }),
        expect.objectContaining({
          assetId: Number(nestedNote.id.slice("note-".length)),
          parentFolderId: nestedFolder.id,
          depth: 3,
          pathFolderIds: [targetFolder.id, movedFolder.id, nestedFolder.id],
          pathFolderSlugs: [
            targetFolder.slug,
            movedFolder.slug,
            nestedFolder.slug,
          ],
        }),
      ]),
    );

    await expect(
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        movedFolder.slug,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects folder cycles and destination slug collisions without changing the subtree", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Folder Move Validation" },
    );
    const source = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Source" },
    );
    const descendant = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Descendant", parentFolderPath: source.slug },
    );

    await expect(
      collectionService.moveNodeToFolder(
        fixture.organizationId,
        collection.slug,
        `folder-${source.id}`,
        {
          targetFolderNodeId: `folder-${descendant.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).rejects.toMatchObject({ code: "validation_error" });

    const target = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Target" },
    );
    await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Source", parentFolderPath: target.slug },
    );

    await expect(
      collectionService.moveNodeToFolder(
        fixture.organizationId,
        collection.slug,
        `folder-${source.id}`,
        {
          targetFolderNodeId: `folder-${target.id}`,
          expectedParentFolderNodeId: null,
        },
      ),
    ).rejects.toMatchObject({ code: "conflict" });

    const originalContents = await collectionService.getCollectionContents(
      fixture.organizationId,
      collection.slug,
      source.slug,
    );
    expect(originalContents.nodes).toContainEqual(
      expect.objectContaining({ id: `folder-${descendant.id}` }),
    );
  });

  it("resolves nested folder paths without changing node placement", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Reference Board" },
    );
    const rootFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "References", position: { x: 48, y: 72 } },
    );
    const nestedFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        name: "Typography",
        parentFolderPath: rootFolder.slug,
        position: { x: 336, y: 72 },
      },
    );
    const note = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      {
        content: "Use a wide serif for headlines.",
        parentFolderPath: `${rootFolder.slug}/${nestedFolder.slug}`,
        position: { x: 624, y: 72 },
      },
    );

    const [
      contents,
      rootContents,
      folderContents,
      lightCollections,
      detailedCollections,
    ] = await Promise.all([
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        `${rootFolder.slug}/${nestedFolder.slug}`,
      ),
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
      ),
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        rootFolder.slug,
      ),
      collectionService.getLightCollections(fixture.organizationId),
      collectionService.getDetailedCollections(fixture.organizationId),
    ]);

    expect(contents.breadcrumbs.map((folder) => folder.slug)).toEqual([
      rootFolder.slug,
      nestedFolder.slug,
    ]);
    expect(contents.nodes).toEqual([
      expect.objectContaining({
        id: note.id,
        type: "note",
        content: "Use a wide serif for headlines.",
        position: { x: 624, y: 72 },
      }),
    ]);
    expect(rootContents.nodes).toEqual([
      expect.objectContaining({
        id: `folder-${rootFolder.id}`,
        type: "folder",
        count: 1,
      }),
    ]);
    expect(folderContents.nodes).toEqual([
      expect.objectContaining({
        id: `folder-${nestedFolder.id}`,
        type: "folder",
        count: 1,
      }),
    ]);
    expect(lightCollections).toEqual([
      expect.objectContaining({ id: collection.id, assetCount: 1 }),
    ]);
    expect(detailedCollections).toEqual([
      expect.objectContaining({ id: collection.id, assetCount: 1 }),
    ]);
  });

  it("filters direct collection contents by node type", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Type Filter" },
    );
    const folder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "References" },
    );
    const note = await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "Filter me" },
    );

    const [notes, folders] = await Promise.all([
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        undefined,
        ["note"],
      ),
      collectionService.getCollectionContents(
        fixture.organizationId,
        collection.slug,
        undefined,
        ["folder"],
      ),
    ]);

    expect(notes.nodes).toEqual([expect.objectContaining({ id: note.id })]);
    expect(folders.nodes).toEqual([
      expect.objectContaining({ id: `folder-${folder.id}` }),
    ]);
  });

  it("deletes a folder subtree and all descendant assets", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Delete Test" },
    );
    const rootFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Temporary" },
    );
    const nestedFolder = await collectionService.createFolder(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { name: "Nested", parentFolderPath: rootFolder.slug },
    );
    await collectionService.createNote(
      fixture.organizationId,
      fixture.userId,
      collection.slug,
      { content: "Remove this note.", parentFolderPath: nestedFolder.path },
    );

    await expect(
      collectionService.deleteNode(
        fixture.organizationId,
        collection.slug,
        `folder-${rootFolder.id}`,
      ),
    ).resolves.toEqual({
      deletedNodeId: `folder-${rootFolder.id}`,
      deletedAssetCount: 1,
    });

    const [remainingNodes, remainingAssets, remainingFolders] =
      await Promise.all([
        db
          .select({ id: collectionNodes.id })
          .from(collectionNodes)
          .where(eq(collectionNodes.collectionId, collection.id)),
        db
          .select({ id: assets.id })
          .from(assets)
          .where(eq(assets.organizationId, fixture.organizationId)),
        db
          .select({ id: folders.id })
          .from(folders)
          .where(eq(folders.organizationId, fixture.organizationId)),
      ]);

    expect(remainingNodes).toEqual([]);
    expect(remainingAssets).toEqual([]);
    expect(remainingFolders).toEqual([]);
  });
});

describe("ImageUploadService integration", () => {
  it("finalizes an upload into its reserved collection position", async () => {
    const collection = await collectionService.createCollection(
      fixture.organizationId,
      fixture.userId,
      { name: "Upload Target" },
    );
    const storageId = randomUUID();
    const originalObjectKey = `ingest/${storageId}/original.jpg`;
    const [upload] = await db
      .insert(uploads)
      .values({
        organizationId: fixture.organizationId,
        collectionId: collection.id,
        positionX: 72,
        positionY: 120,
        source: "direct",
        status: "uploaded",
        originalObjectKey,
        storageId,
        fileName: "reference.jpg",
        contentType: "image/jpeg",
        sizeBytes: 2_000,
        createdByUserId: fixture.userId,
      })
      .returning({ id: uploads.id });

    expect(upload).toBeDefined();
    const result = await imageUploadService.handlePipelineCallback({
      event: "image.variants.completed",
      originalObjectKey,
      originalEtag: "etag-1",
      width: 1200,
      height: 800,
      format: "jpeg",
      blurDataURL: "data:image/webp;base64,AA==",
      variants: [
        {
          role: "display",
          objectKey: `assets/${storageId}/display.webp`,
          width: 1200,
          height: 800,
          contentType: "image/webp",
          sizeBytes: 1_000,
        },
        {
          role: "preview",
          objectKey: `assets/${storageId}/preview.webp`,
          width: 400,
          height: 267,
          contentType: "image/webp",
          sizeBytes: 500,
        },
      ],
    });

    expect(result).toEqual({ ignored: false });

    const [finalizedUpload] = await db
      .select({ status: uploads.status, assetId: uploads.assetId })
      .from(uploads)
      .where(eq(uploads.id, upload!.id));
    expect(finalizedUpload).toMatchObject({ status: "completed" });
    expect(finalizedUpload?.assetId).toBeTypeOf("number");

    const [imageRows, nodeRows] = await Promise.all([
      db
        .select({ variants: imageAssets.variants })
        .from(imageAssets)
        .where(eq(imageAssets.assetId, finalizedUpload!.assetId!)),
      db
        .select({
          assetId: collectionNodes.assetId,
          positionX: collectionNodes.positionX,
          positionY: collectionNodes.positionY,
        })
        .from(collectionNodes)
        .where(eq(collectionNodes.assetId, finalizedUpload!.assetId!)),
    ]);

    const image = imageRows[0];
    const node = nodeRows[0];

    expect(image?.variants.display?.objectKey).toBe(
      `assets/${storageId}/display.webp`,
    );
    expect(node).toEqual({
      assetId: finalizedUpload!.assetId,
      positionX: 72,
      positionY: 120,
    });
  });
});
