import { and, eq } from "drizzle-orm";
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
} from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { calculateNoteMetrics } from "@/lib/note-metrics";
import { first } from "@/lib/query";
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
    const collection = await getCollection(orgId, collectionSlug);
    const parentPath = await resolveParentPath(
      collection.id,
      data.parentFolderPath,
    );
    const slug = await getAvailableFolderSlug(
      collection.id,
      parentPath.slugs,
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
        parentFolderId: parentPath.folderId,
        nodeType: "folder",
        folderId: insertedFolder.id,
        sortKey: makeSortKey(),
        depth: parentPath.slugs.length,
        pathFolderIds: [...parentPath.folderIds, insertedFolder.id],
        pathFolderSlugs: [...parentPath.slugs, insertedFolder.slug],
        pathFolderNames: [...parentPath.names, insertedFolder.name],
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
      path: [...parentPath.slugs, folder.slug].join("/"),
      count: 0,
      previews: [],
    };
  }

  async createNote(
    orgId: string,
    userId: string,
    collectionSlug: string,
    data: CreateNoteInput,
  ): Promise<CollectionNoteNode> {
    const collection = await getCollection(orgId, collectionSlug);
    const parentPath = await resolveParentPath(
      collection.id,
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
        parentFolderId: parentPath.folderId,
        nodeType: "asset",
        assetId: insertedAsset.id,
        sortKey: makeSortKey(),
        depth: parentPath.slugs.length,
        pathFolderIds: parentPath.folderIds,
        pathFolderSlugs: parentPath.slugs,
        pathFolderNames: parentPath.names,
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
    };
  }
}

async function getCollection(orgId: string, collectionSlug: string) {
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

async function resolveParentPath(
  collectionId: number,
  parentFolderPath?: string,
) {
  const slugs = parentFolderPath?.split("/").filter(Boolean) ?? [];
  if (slugs.length === 0) {
    return {
      folderId: null,
      folderIds: [] as number[],
      slugs,
      names: [] as string[],
    };
  }

  const parentFolder = first(
    await db
      .select({
        folderId: collectionNodes.folderId,
        pathFolderIds: collectionNodes.pathFolderIds,
        pathFolderNames: collectionNodes.pathFolderNames,
      })
      .from(collectionNodes)
      .where(
        and(
          eq(collectionNodes.collectionId, collectionId),
          eq(collectionNodes.pathFolderSlugs, slugs),
          eq(collectionNodes.nodeType, "folder"),
        ),
      ),
  );

  if (!parentFolder?.folderId) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Parent folder not found in collection",
    );
  }

  return {
    folderId: parentFolder.folderId,
    folderIds: parentFolder.pathFolderIds,
    slugs,
    names: parentFolder.pathFolderNames,
  };
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

function makeSortKey(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}
