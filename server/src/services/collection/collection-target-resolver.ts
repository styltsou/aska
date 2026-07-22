import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { collectionNodes, collectionsTable } from "@/db/schema";
import { AppError, ErrorCode } from "@/lib/errors";
import { first } from "@/lib/query";

export type CollectionIdentity = {
  id: number;
  name: string;
  slug: string;
};

export type CollectionTarget = {
  collection: CollectionIdentity;
  parentFolderId: number | null;
  pathFolderIds: number[];
  pathFolderSlugs: string[];
  pathFolderNames: string[];
};

/** Finds a tenant-scoped collection before a read or mutation operates on it. */
export async function getCollectionBySlug(
  orgId: string,
  collectionSlug: string,
): Promise<CollectionIdentity> {
  const collection = first(
    await db
      .select({
        id: collectionsTable.id,
        name: collectionsTable.name,
        slug: collectionsTable.slug,
      })
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

  return collection;
}

/** Resolves a collection slug and optional folder path into persisted placement fields. */
export async function resolveCollectionTargetBySlug(
  orgId: string,
  collectionSlug: string | null,
  folderPath?: string,
): Promise<CollectionTarget | null> {
  if (!collectionSlug) return null;
  return resolveTargetInCollection(
    await getCollectionBySlug(orgId, collectionSlug),
    folderPath,
  );
}

/** Re-resolves a saved upload target so deleted collections and folders cannot be reused. */
export async function resolveCollectionTargetById(
  orgId: string,
  collectionId: number | null,
  folderPath?: string,
): Promise<CollectionTarget | null> {
  if (!collectionId) return null;

  const collection = first(
    await db
      .select({
        id: collectionsTable.id,
        name: collectionsTable.name,
        slug: collectionsTable.slug,
      })
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.id, collectionId),
          eq(collectionsTable.organizationId, orgId),
        ),
      )
      .limit(1),
  );

  if (!collection) {
    throw new AppError(ErrorCode.NOT_FOUND, "Collection no longer exists");
  }

  return resolveTargetInCollection(collection, folderPath);
}

/** Resolves a folder path without re-querying the collection identity. */
export async function resolveTargetInCollection(
  collection: CollectionIdentity,
  folderPath?: string,
): Promise<CollectionTarget> {
  const pathFolderSlugs = folderPath?.split("/").filter(Boolean) ?? [];
  if (pathFolderSlugs.length === 0) {
    return {
      collection,
      parentFolderId: null,
      pathFolderIds: [],
      pathFolderSlugs: [],
      pathFolderNames: [],
    };
  }

  const folderNode = first(
    await db
      .select({
        folderId: collectionNodes.folderId,
        pathFolderIds: collectionNodes.pathFolderIds,
        pathFolderSlugs: collectionNodes.pathFolderSlugs,
        pathFolderNames: collectionNodes.pathFolderNames,
      })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.collectionId, collection.id),
          eq(collectionNodes.pathFolderSlugs, pathFolderSlugs),
          eq(collectionNodes.nodeType, "folder"),
        ),
      )
      .limit(1),
  );

  if (!folderNode?.folderId) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Parent folder not found in collection",
    );
  }

  return { collection, parentFolderId: folderNode.folderId, ...folderNode };
}
