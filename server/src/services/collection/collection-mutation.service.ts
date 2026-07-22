import { and, eq, isNull } from "drizzle-orm";
import slugify from "slugify";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  collectionsTable,
  folders,
  noteAssets,
} from "@/db/schema";
import type {
  CollectionNoteNode,
  CreateCollectionInput,
  CreateFolderInput,
  CreateNoteInput,
  CreatedFolder,
  UpdateNodePositionInput,
  UpdateNodePositionsInput,
} from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseCollectionNodeId } from "@/lib/collection-node-id";
import { calculateNoteMetrics } from "@/lib/note-metrics";
import {
  getCollectionBySlug,
  resolveTargetInCollection,
} from "./collection-target-resolver";
import type { CreatedCollectionRow } from "./collection.types";

export class CollectionMutationService {
  async createCollection(
    orgId: string,
    userId: string,
    data: CreateCollectionInput,
  ): Promise<CreatedCollectionRow> {
    let slug = slugify(data.name, { lower: true, strict: true });

    if (!slug) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Name must contain at least one letter or number",
      );
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
      const existing = await db
        .select({ id: collectionsTable.id })
        .from(collectionsTable)
        .where(
          and(
            eq(collectionsTable.organizationId, orgId),
            eq(collectionsTable.slug, candidate),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        slug = candidate;
        break;
      }
    }

    const [inserted] = await db
      .insert(collectionsTable)
      .values({
        organizationId: orgId,
        name: data.name,
        slug,
        createdByUserId: userId,
        updatedByUserId: userId,
      })
      .returning();

    if (!inserted) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Failed to create collection",
      );
    }

    return inserted;
  }

  async createFolder(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateFolderInput,
  ): Promise<CreatedFolder> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const parentTarget = await resolveTargetInCollection(
      collection,
      data.parentFolderPath,
    );
    const slug = await getAvailableFolderSlug(
      collection.id,
      parentTarget.pathFolderSlugs,
      data.name,
    );

    const folder = await db.transaction(async (tx) => {
      const [insertedFolder] = await tx
        .insert(folders)
        .values({
          organizationId: orgId,
          name: data.name,
          slug,
          createdByUserId: userId,
          updatedByUserId: userId,
        })
        .returning();

      if (!insertedFolder) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create folder");
      }

      await tx.insert(collectionNodes).values({
        organizationId: orgId,
        collectionId: collection.id,
        parentFolderId: parentTarget.parentFolderId,
        nodeType: "folder",
        folderId: insertedFolder.id,
        positionX: data.position?.x,
        positionY: data.position?.y,
        depth: parentTarget.pathFolderSlugs.length,
        pathFolderIds: [...parentTarget.pathFolderIds, insertedFolder.id],
        pathFolderSlugs: [...parentTarget.pathFolderSlugs, insertedFolder.slug],
        pathFolderNames: [...parentTarget.pathFolderNames, insertedFolder.name],
      });

      return insertedFolder;
    });

    if (!folder) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create folder");
    }

    return {
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      path: [...parentTarget.pathFolderSlugs, folder.slug].join("/"),
      count: 0,
      previews: [],
      position: data.position ?? null,
    };
  }

  async createNote(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateNoteInput,
  ): Promise<CollectionNoteNode> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const parentTarget = await resolveTargetInCollection(
      collection,
      data.parentFolderPath,
    );

    const note = await db.transaction(async (tx) => {
      const [insertedAsset] = await tx
        .insert(assets)
        .values({
          organizationId: orgId,
          type: "note",
          createdByUserId: userId,
          updatedByUserId: userId,
        })
        .returning();

      if (!insertedAsset) {
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create note");
      }

      await tx.insert(noteAssets).values({
        assetId: insertedAsset.id,
        markdown: data.content,
        color: data.color,
      });

      await tx.insert(collectionNodes).values({
        organizationId: orgId,
        collectionId: collection.id,
        parentFolderId: parentTarget.parentFolderId,
        nodeType: "asset",
        assetId: insertedAsset.id,
        positionX: data.position?.x,
        positionY: data.position?.y,
        depth: parentTarget.pathFolderSlugs.length,
        pathFolderIds: parentTarget.pathFolderIds,
        pathFolderSlugs: parentTarget.pathFolderSlugs,
        pathFolderNames: parentTarget.pathFolderNames,
      });

      return insertedAsset;
    });

    if (!note) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create note");
    }

    const { wordCount, readingTimeMinutes } = calculateNoteMetrics(
      data.content,
    );

    return {
      id: `note-${note.id}`,
      type: "note",
      content: data.content,
      color: data.color ?? null,
      isFavorite: false,
      wordCount,
      readingTimeMinutes,
      position: data.position ?? null,
    };
  }

  async updateNodePosition(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
    data: UpdateNodePositionInput,
  ): Promise<{
    nodeId: string;
    position: UpdateNodePositionInput["position"];
  }> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const target = parseCollectionNodeId(nodeId);
    const expectedParent = data.expectedParentFolderNodeId
      ? parseCollectionNodeId(data.expectedParentFolderNodeId)
      : null;
    if (expectedParent && expectedParent.nodeType !== "folder") {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Expected parent must be a folder node",
      );
    }
    const targetCondition =
      target.nodeType === "folder"
        ? and(
            eq(collectionNodes.nodeType, "folder"),
            eq(collectionNodes.folderId, target.entityId),
          )
        : and(
            eq(collectionNodes.nodeType, "asset"),
            eq(collectionNodes.assetId, target.entityId),
          );
    const [updated] = await db
      .update(collectionNodes)
      .set({ positionX: data.position.x, positionY: data.position.y })
      .where(
        and(
          eq(collectionNodes.organizationId, orgId),
          eq(collectionNodes.collectionId, collection.id),
          targetCondition,
          data.expectedParentFolderNodeId === null
            ? isNull(collectionNodes.parentFolderId)
            : eq(collectionNodes.parentFolderId, expectedParent!.entityId),
        ),
      )
      .returning({ id: collectionNodes.id });

    if (!updated) {
      const existing = await db
        .select({ id: collectionNodes.id })
        .from(collectionNodes)
        .where(
          and(
            eq(collectionNodes.organizationId, orgId),
            eq(collectionNodes.collectionId, collection.id),
            targetCondition,
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new AppError(
          ErrorCode.CONFLICT,
          "Collection node moved before its position could be saved",
        );
      }
      throw new AppError(ErrorCode.NOT_FOUND, "Collection node not found");
    }

    return { nodeId, position: data.position };
  }

  async updateNodePositions(
    orgId: string,
    collectionSlug: string,
    data: UpdateNodePositionsInput,
  ): Promise<{ nodeIds: string[] }> {
    const collection = await getCollectionBySlug(orgId, collectionSlug);
    const expectedParent = data.expectedParentFolderNodeId
      ? parseCollectionNodeId(data.expectedParentFolderNodeId)
      : null;
    if (expectedParent && expectedParent.nodeType !== "folder") {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Expected parent must be a folder node",
      );
    }

    const targets = data.positions.map(({ nodeId, position }) => ({
      nodeId,
      position,
      target: parseCollectionNodeId(nodeId),
    }));

    await db.transaction(async (tx) => {
      for (const { target, position } of targets) {
        const targetCondition =
          target.nodeType === "folder"
            ? and(
                eq(collectionNodes.nodeType, "folder"),
                eq(collectionNodes.folderId, target.entityId),
              )
            : and(
                eq(collectionNodes.nodeType, "asset"),
                eq(collectionNodes.assetId, target.entityId),
              );
        const [updated] = await tx
          .update(collectionNodes)
          .set({ positionX: position.x, positionY: position.y })
          .where(
            and(
              eq(collectionNodes.organizationId, orgId),
              eq(collectionNodes.collectionId, collection.id),
              targetCondition,
              data.expectedParentFolderNodeId === null
                ? isNull(collectionNodes.parentFolderId)
                : eq(collectionNodes.parentFolderId, expectedParent!.entityId),
            ),
          )
          .returning({ id: collectionNodes.id });

        if (!updated) {
          throw new AppError(
            ErrorCode.CONFLICT,
            "A collection node moved before its positions could be saved",
          );
        }
      }
    });

    return { nodeIds: data.positions.map(({ nodeId }) => nodeId) };
  }
}

async function getAvailableFolderSlug(
  collectionId: number,
  parentPathSlugs: string[],
  name: string,
): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true });
  if (!baseSlug) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Name must contain at least one letter or number",
    );
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const existing = await db
      .select({ id: collectionNodes.id })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.collectionId, collectionId),
          eq(collectionNodes.pathFolderSlugs, [...parentPathSlugs, candidate]),
          eq(collectionNodes.nodeType, "folder"),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return candidate;
    }
  }

  throw new AppError(
    ErrorCode.CONFLICT,
    "A folder with this name already exists",
  );
}
