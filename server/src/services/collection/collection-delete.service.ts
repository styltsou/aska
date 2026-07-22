import { and, arrayContains, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  collectionsTable,
  folders,
} from "@/db/schema";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseCollectionNodeId } from "@/lib/collection-node-id";
import { first } from "@/lib/query";
import type { IObjectStorageService } from "@/services/object-storage.service";
import { collectAssetObjectKeys } from "@/services/asset.service";
import type { DeleteCollectionNodeResult } from "./collection.types";

export class CollectionDeleteService {
  private readonly objectStorageService: IObjectStorageService;

  constructor(deps: { objectStorageService: IObjectStorageService }) {
    this.objectStorageService = deps.objectStorageService;
  }

  async deleteNode(
    orgId: string,
    collectionSlug: string,
    nodeId: string,
  ): Promise<DeleteCollectionNodeResult> {
    const collectionId = await getCollectionIdBySlug(orgId, collectionSlug);
    const target = parseCollectionNodeId(nodeId);

    if (target.nodeType !== "folder") {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Only folders can be deleted from a collection. Use the asset delete endpoint for assets.",
      );
    }

    const deletedAssetCount = await deleteFolderNode(
      orgId,
      collectionId,
      target.entityId,
      this.objectStorageService,
    );

    return { deletedNodeId: nodeId, deletedAssetCount };
  }

  async deleteFolders(
    orgId: string,
    collectionSlug: string,
    folderIds: number[],
  ): Promise<number> {
    const collectionId = await getCollectionIdBySlug(orgId, collectionSlug);
    let deletedAssetCount = 0;

    for (const folderId of folderIds) {
      deletedAssetCount += await deleteFolderNode(
        orgId,
        collectionId,
        folderId,
        this.objectStorageService,
      );
    }

    return deletedAssetCount;
  }
}

async function getCollectionIdBySlug(
  orgId: string,
  collectionSlug: string,
): Promise<number> {
  const collection = first(
    await db
      .select({ id: collectionsTable.id })
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.organizationId, orgId),
          eq(collectionsTable.slug, collectionSlug),
        ),
      ),
  );

  if (!collection) {
    throw new AppError(ErrorCode.NOT_FOUND, "Collection not found");
  }

  return collection.id;
}

async function deleteFolderNode(
  orgId: string,
  collectionId: number,
  folderId: number,
  objectStorageService: IObjectStorageService,
): Promise<number> {
  const folderNode = first(
    await db
      .select({
        folderId: collectionNodes.folderId,
        pathFolderIds: collectionNodes.pathFolderIds,
      })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.organizationId, orgId),
          eq(collectionNodes.collectionId, collectionId),
          eq(collectionNodes.nodeType, "folder"),
          eq(collectionNodes.folderId, folderId),
        ),
      )
      .limit(1),
  );

  if (!folderNode?.folderId) {
    throw new AppError(ErrorCode.NOT_FOUND, "Folder not found in collection");
  }

  const { assetIds, folderIds } = await getFolderDeleteTargets(
    orgId,
    collectionId,
    folderNode.pathFolderIds,
  );

  if (assetIds.length > 0) {
    const keys = await collectAssetObjectKeys(orgId, assetIds);
    if (keys.length > 0) {
      // TODO: if this becomes slow, move R2 deletion to a background job
      await objectStorageService.deleteObjects(keys);
    }
  }

  await db.transaction(async (tx) => {
    if (assetIds.length > 0) {
      await tx
        .delete(assets)
        .where(
          and(eq(assets.organizationId, orgId), inArray(assets.id, assetIds)),
        );
    }

    if (folderIds.length > 0) {
      await tx
        .delete(folders)
        .where(
          and(
            eq(folders.organizationId, orgId),
            inArray(folders.id, folderIds),
          ),
        );
    }
  });

  return assetIds.length;
}

async function getFolderDeleteTargets(
  orgId: string,
  collectionId: number,
  pathFolderIds: number[],
): Promise<{ assetIds: number[]; folderIds: number[] }> {
  const [assetRows, folderRows] = await Promise.all([
    db
      .select({ assetId: collectionNodes.assetId })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.organizationId, orgId),
          eq(collectionNodes.collectionId, collectionId),
          eq(collectionNodes.nodeType, "asset"),
          arrayContains(collectionNodes.pathFolderIds, pathFolderIds),
        ),
      ),
    db
      .select({ folderId: collectionNodes.folderId })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.organizationId, orgId),
          eq(collectionNodes.collectionId, collectionId),
          eq(collectionNodes.nodeType, "folder"),
          arrayContains(collectionNodes.pathFolderIds, pathFolderIds),
        ),
      ),
  ]);

  return {
    assetIds: assetRows
      .map((row) => row.assetId)
      .filter((assetId): assetId is number => assetId !== null),
    folderIds: folderRows
      .map((row) => row.folderId)
      .filter((folderId): folderId is number => folderId !== null),
  };
}
