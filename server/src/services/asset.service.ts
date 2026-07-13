import { and, desc, eq, inArray, isNull, notExists } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  collectionsTable,
  imageAssets,
  noteAssets,
  uploads,
  type ImageAssetVariants,
} from "@/db/schema";
import type {
  CollectionImageNode,
  CollectionNode,
  CollectionNoteNode,
  CreateNoteInput,
  InboxContentsResponse,
  PlaceAssetInput,
} from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { calculateNoteMetrics } from "@/lib/note-metrics";
import { first } from "@/lib/query";
import type { IObjectStorageService } from "@/services/object-storage.service";

type Deps = {
  objectStorageService: IObjectStorageService;
};

type ParentPath = {
  folderId: number | null;
  folderIds: number[];
  slugs: string[];
  names: string[];
};

export interface IAssetService {
  getInboxContents(orgId: string): Promise<InboxContentsResponse>;
  createInboxNote(
    orgId: string,
    userId: string,
    data: CreateNoteInput,
  ): Promise<CollectionNoteNode>;
  placeAsset(
    orgId: string,
    assetNodeId: string,
    data: PlaceAssetInput,
  ): Promise<CollectionNode>;
  deleteAsset(
    orgId: string,
    assetNodeId: string,
  ): Promise<{ deletedAssetId: string }>;
}

export class AssetService implements IAssetService {
  private readonly objectStorageService: IObjectStorageService;

  constructor(deps: Deps) {
    this.objectStorageService = deps.objectStorageService;
  }

  async getInboxContents(orgId: string): Promise<InboxContentsResponse> {
    const rows = await db
      .select({
        assetId: assets.id,
        assetType: assets.type,
        title: assets.title,
        isFavorite: assets.isFavorite,
        createdAt: assets.createdAt,
        imageAlt: imageAssets.alt,
        sourceLabel: imageAssets.sourceLabel,
        sourceUrl: imageAssets.sourceUrl,
        imageVariants: imageAssets.variants,
        imageBlurDataURL: imageAssets.blurDataURL,
        imageDominantColors: imageAssets.dominantColors,
        noteContent: noteAssets.markdown,
        noteColor: noteAssets.color,
      })
      .from(assets)
      .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
      .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
      .where(
        and(
          eq(assets.organizationId, orgId),
          notExists(
            db
              .select({ id: collectionNodes.id })
              .from(collectionNodes)
              .where(
                and(
                  eq(collectionNodes.organizationId, orgId),
                  eq(collectionNodes.nodeType, "asset"),
                  eq(collectionNodes.assetId, assets.id),
                ),
              ),
          ),
        ),
      )
      .orderBy(desc(assets.createdAt), desc(assets.id));

    return {
      collection: {
        id: 0,
        name: "Inbox",
        slug: "inbox",
      },
      breadcrumbs: [],
      nodes: await this.rowsToAssetNodes(rows),
    };
  }

  async createInboxNote(
    orgId: string,
    userId: string,
    data: CreateNoteInput,
  ): Promise<CollectionNoteNode> {
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

      return insertedAsset;
    });

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

  async placeAsset(
    orgId: string,
    assetNodeId: string,
    data: PlaceAssetInput,
  ): Promise<CollectionNode> {
    const target = parseAssetNodeId(assetNodeId);
    const asset = await this.getAssetRow(orgId, target.entityId);

    const collection = await getCollection(orgId, data.collectionSlug);
    const parentPath = await resolveParentPath(
      collection.id,
      data.parentFolderPath,
    );

    await db.transaction(async (tx) => {
      await tx
        .delete(collectionNodes)
        .where(
          and(
            eq(collectionNodes.organizationId, orgId),
            eq(collectionNodes.nodeType, "asset"),
            eq(collectionNodes.assetId, asset.id),
          ),
        );

      await tx.insert(collectionNodes).values({
        organizationId: orgId,
        collectionId: collection.id,
        parentFolderId: parentPath.folderId,
        nodeType: "asset",
        assetId: asset.id,
        sortKey: makeSortKey(),
        depth: parentPath.slugs.length,
        pathFolderIds: parentPath.folderIds,
        pathFolderSlugs: parentPath.slugs,
        pathFolderNames: parentPath.names,
      });
    });

    return this.getAssetNode(orgId, asset.id);
  }

  async deleteAsset(
    orgId: string,
    assetNodeId: string,
  ): Promise<{ deletedAssetId: string }> {
    const target = parseAssetNodeId(assetNodeId);
    const assetId = target.entityId;

    if (target.assetType === "image") {
      const keys = await collectAssetObjectKeys(orgId, [assetId]);
      if (keys.length > 0) {
        await this.objectStorageService.deleteObjects(keys);
      }
    }

    await db
      .delete(assets)
      .where(and(eq(assets.organizationId, orgId), eq(assets.id, assetId)));

    return { deletedAssetId: assetNodeId };
  }

  private async getAssetNode(
    orgId: string,
    assetId: number,
  ): Promise<CollectionNode> {
    const row = first(
      await db
        .select({
          assetId: assets.id,
          assetType: assets.type,
          title: assets.title,
          isFavorite: assets.isFavorite,
          createdAt: assets.createdAt,
          imageAlt: imageAssets.alt,
          sourceLabel: imageAssets.sourceLabel,
          sourceUrl: imageAssets.sourceUrl,
          imageVariants: imageAssets.variants,
          imageBlurDataURL: imageAssets.blurDataURL,
          imageDominantColors: imageAssets.dominantColors,
          noteContent: noteAssets.markdown,
          noteColor: noteAssets.color,
        })
        .from(assets)
        .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
        .where(and(eq(assets.organizationId, orgId), eq(assets.id, assetId)))
        .limit(1),
    );

    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
    }

    return (await this.rowsToAssetNodes([row]))[0]!;
  }

  private async getAssetRow(orgId: string, assetId: number) {
    const asset = first(
      await db
        .select({
          id: assets.id,
          type: assets.type,
        })
        .from(assets)
        .where(and(eq(assets.organizationId, orgId), eq(assets.id, assetId)))
        .limit(1),
    );

    if (!asset) {
      throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
    }

    return asset;
  }

  private async rowsToAssetNodes(
    rows: Array<{
      assetId: number;
      assetType: "image" | "note";
      title: string | null;
      isFavorite: boolean;
      createdAt: Date;
      imageAlt: string | null;
      sourceLabel: string | null;
      sourceUrl: string | null;
      imageVariants: ImageAssetVariants | null;
      imageBlurDataURL: string | null;
      imageDominantColors: string[] | null;
      noteContent: string | null;
      noteColor: string | null;
    }>,
  ): Promise<CollectionNode[]> {
    const nodes: CollectionNode[] = [];

    for (const row of rows) {
      if (row.assetType === "image") {
        const display = row.imageVariants?.display;
        if (!display?.objectKey) continue;

        const [signed, originalSigned] = await Promise.all([
          this.objectStorageService.createPresignedGetUrl(display.objectKey),
          row.imageVariants?.original?.objectKey
            ? this.objectStorageService.createPresignedGetUrl(
                row.imageVariants.original.objectKey,
              )
            : undefined,
        ]);
        nodes.push({
          id: `image-${row.assetId}`,
          type: "image",
          url: signed.url,
          originalUrl: originalSigned?.url,
          originalWidth: row.imageVariants?.original?.width,
          originalHeight: row.imageVariants?.original?.height,
          width: display.width,
          height: display.height,
          title: row.title,
          alt: row.imageAlt,
          sourceLabel: row.sourceLabel,
          sourceUrl: row.sourceUrl,
          isFavorite: row.isFavorite,
          blurDataURL: row.imageBlurDataURL,
          dominantColors: row.imageDominantColors ?? undefined,
          sizeBytes: display.sizeBytes,
          createdAt: row.createdAt.toISOString(),
        } satisfies CollectionImageNode);
        continue;
      }

      const content = row.noteContent ?? "";
      const { wordCount, readingTimeMinutes } = calculateNoteMetrics(content);
      nodes.push({
        id: `note-${row.assetId}`,
        type: "note",
        content,
        color: row.noteColor,
        isFavorite: row.isFavorite,
        wordCount,
        readingTimeMinutes,
      } satisfies CollectionNoteNode);
    }

    return nodes;
  }
}

export async function collectAssetObjectKeys(
  orgId: string,
  assetIds: number[],
): Promise<string[]> {
  if (assetIds.length === 0) return [];

  const [imageRows, uploadRows] = await Promise.all([
    db
      .select({ variants: imageAssets.variants })
      .from(imageAssets)
      .where(inArray(imageAssets.assetId, assetIds)),
    db
      .select({ originalObjectKey: uploads.originalObjectKey })
      .from(uploads)
      .where(
        and(
          eq(uploads.organizationId, orgId),
          inArray(uploads.assetId, assetIds),
        ),
      ),
  ]);

  const keys = new Set<string>();

  for (const row of imageRows) {
    for (const variant of Object.values(row.variants)) {
      if (variant?.objectKey) {
        keys.add(variant.objectKey);
      }
    }
  }

  for (const row of uploadRows) {
    if (row.originalObjectKey) {
      keys.add(row.originalObjectKey);
    }
  }

  return [...keys];
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
      )
      .limit(1),
  );

  if (!collection) {
    throw new AppError(ErrorCode.NOT_FOUND, "Collection not found");
  }

  return collection;
}

async function resolveParentPath(
  collectionId: number,
  parentFolderPath?: string,
): Promise<ParentPath> {
  const slugs = parentFolderPath?.split("/").filter(Boolean) ?? [];
  if (slugs.length === 0) {
    return {
      folderId: null,
      folderIds: [],
      slugs,
      names: [],
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
          isNull(collectionNodes.assetId),
        ),
      )
      .limit(1),
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

function parseAssetNodeId(nodeId: string): {
  assetType: "image" | "note";
  entityId: number;
} {
  const [assetType, rawId] = nodeId.split("-");
  const entityId = Number(rawId);

  if (
    (assetType !== "image" && assetType !== "note") ||
    !Number.isInteger(entityId)
  ) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid asset id");
  }

  return { assetType, entityId };
}

function makeSortKey(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID()}`;
}
