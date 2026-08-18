import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  notExists,
} from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  imageAssets,
  member,
  noteAssets,
  uploads,
  type ImageAssetVariants,
} from "@/db/schema";
import type {
  CollectionImageNode,
  CollectionNode,
  CollectionNoteNode,
  ContentTypeFilter,
  CreateNoteInput,
  InboxContentsResponse,
} from "@/dto/collection.dto";
import type { BulkDeleteResult } from "@/services/collection/collection.types";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseAssetNodeId } from "@/lib/collection-node-id";
import { calculateNoteMetrics } from "@/lib/note-metrics";
import { first } from "@/lib/query";
import type { IObjectStorageService } from "@/services/object-storage.service";

type Deps = {
  objectStorageService: IObjectStorageService;
};

export type AssetDownload = {
  bytes: Uint8Array;
  contentType: string;
  filename: string;
};

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/["\r\n;]/g, "");
  const safe = trimmed.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 100);
  return safe.length > 0 ? safe : "image";
}

export interface IAssetService {
  getInboxContents(
    orgId: string,
    types?: ContentTypeFilter[],
  ): Promise<InboxContentsResponse>;
  getInboxStatus(
    orgId: string,
    userId: string,
  ): Promise<{ unreadCount: number }>;
  markInboxSeen(orgId: string, userId: string): Promise<{ lastSeenAt: Date }>;
  createInboxNote(
    orgId: string,
    userId: string,
    data: CreateNoteInput,
  ): Promise<CollectionNoteNode>;
  deleteAsset(
    orgId: string,
    assetNodeId: string,
  ): Promise<{ deletedAssetId: string }>;
  downloadAsset(
    orgId: string,
    assetNodeId: string,
    signal?: AbortSignal,
  ): Promise<AssetDownload>;
  bulkDeleteAssets(orgId: string, nodeIds: string[]): Promise<BulkDeleteResult>;
}

export class AssetService implements IAssetService {
  private readonly objectStorageService: IObjectStorageService;

  constructor({ objectStorageService }: Deps) {
    this.objectStorageService = objectStorageService;
  }

  async getInboxContents(
    orgId: string,
    types?: ContentTypeFilter[],
  ): Promise<InboxContentsResponse> {
    const assetTypes = types?.filter(
      (type): type is "image" | "note" => type !== "folder",
    );

    if (types !== undefined && assetTypes?.length === 0) {
      return {
        collection: { id: 0, name: "Inbox", slug: "inbox" },
        breadcrumbs: [],
        nodes: [],
      };
    }

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
          assetTypes && assetTypes.length > 0
            ? inArray(assets.type, assetTypes)
            : undefined,
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

  async getInboxStatus(
    orgId: string,
    userId: string,
  ): Promise<{ unreadCount: number }> {
    const membership = first(
      await db
        .select({ inboxLastSeenAt: member.inboxLastSeenAt })
        .from(member)
        .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
        .limit(1),
    );

    if (!membership) {
      throw new AppError(ErrorCode.NOT_FOUND, "Workspace membership not found");
    }

    const unread = first(
      await db
        .select({ count: count() })
        .from(assets)
        .where(
          and(
            eq(assets.organizationId, orgId),
            isNotNull(assets.lastAddedToInboxAt),
            membership.inboxLastSeenAt
              ? gt(assets.lastAddedToInboxAt, membership.inboxLastSeenAt)
              : undefined,
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
        ),
    );

    return { unreadCount: Number(unread?.count ?? 0) };
  }

  async markInboxSeen(
    orgId: string,
    userId: string,
  ): Promise<{ lastSeenAt: Date }> {
    const lastSeenAt = new Date();
    const [membership] = await db
      .update(member)
      .set({ inboxLastSeenAt: lastSeenAt })
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
      .returning({ id: member.id });

    if (!membership) {
      throw new AppError(ErrorCode.NOT_FOUND, "Workspace membership not found");
    }

    return { lastSeenAt };
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
          lastAddedToInboxAt: new Date(),
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
      createdAt: note.createdAt.toISOString(),
      position: null,
    };
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

  async downloadAsset(
    orgId: string,
    assetNodeId: string,
    signal?: AbortSignal,
  ): Promise<AssetDownload> {
    const target = parseAssetNodeId(assetNodeId);
    if (target.assetType !== "image") {
      throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
    }

    const row = first(
      await db
        .select({
          title: assets.title,
          variants: imageAssets.variants,
        })
        .from(assets)
        .innerJoin(imageAssets, eq(imageAssets.assetId, assets.id))
        .where(
          and(
            eq(assets.organizationId, orgId),
            eq(assets.id, target.entityId),
            eq(assets.type, "image"),
          ),
        )
        .limit(1),
    );

    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
    }

    const original = row.variants?.original ?? row.variants?.display;
    if (!original?.objectKey) {
      throw new AppError(ErrorCode.NOT_FOUND, "Image object not found");
    }

    const bytes = await this.objectStorageService.getObjectBytes(
      original.objectKey,
      signal,
    );
    const filename = row.title?.trim() ? sanitizeFilename(row.title) : "image";

    return { bytes, contentType: original.contentType, filename };
  }

  async bulkDeleteAssets(
    orgId: string,
    nodeIds: string[],
  ): Promise<BulkDeleteResult> {
    const parsed = nodeIds.map((id) => ({
      nodeId: id,
      parsed: parseAssetNodeId(id),
    }));

    const imageAssetIds = parsed
      .filter((p) => p.parsed.assetType === "image")
      .map((p) => p.parsed.entityId);

    if (imageAssetIds.length > 0) {
      const keys = await collectAssetObjectKeys(orgId, imageAssetIds);
      if (keys.length > 0) {
        await this.objectStorageService.deleteObjects(keys);
      }
    }

    const allAssetIds = parsed.map((p) => p.parsed.entityId);

    await db
      .delete(assets)
      .where(
        and(eq(assets.organizationId, orgId), inArray(assets.id, allAssetIds)),
      );

    return {
      deletedCount: parsed.length,
      deletedAssetCount: parsed.length,
    };
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
        const rendition =
          row.imageVariants?.display ?? row.imageVariants?.original;
        if (!rendition?.objectKey) continue;

        const [signed, originalSigned] = await Promise.all([
          this.objectStorageService.createPresignedGetUrl(rendition.objectKey),
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
          width: rendition.width,
          height: rendition.height,
          title: row.title,
          alt: row.imageAlt,
          sourceLabel: row.sourceLabel,
          sourceUrl: row.sourceUrl,
          isFavorite: row.isFavorite,
          blurDataURL: row.imageBlurDataURL,
          dominantColors: row.imageDominantColors ?? undefined,
          sizeBytes: rendition.sizeBytes,
          createdAt: row.createdAt.toISOString(),
          position: null,
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
        createdAt: row.createdAt.toISOString(),
        position: null,
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
