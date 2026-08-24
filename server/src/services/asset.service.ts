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
  colorAssets,
  collectionNodes,
  externalResources,
  imageAssets,
  linkAssets,
  member,
  noteAssets,
  uploads,
  type ImageAssetVariants,
} from "@/db/schema";
import type {
  CollectionImageNode,
  CollectionColorNode,
  CollectionLinkNode,
  CollectionNode,
  CollectionNoteNode,
  ContentTypeFilter,
  CreateNoteInput,
  CreateColorInput,
  InboxContentsResponse,
  UpdatedNote,
  UpdateNoteInput,
  UpdatedImage,
  UpdateImageInput,
  UpdateColorInput,
  UpdatedColor,
} from "@/dto/collection.dto";
import type { BulkDeleteResult } from "@/services/collection/collection.types";
import { AppError, ErrorCode } from "@/lib/errors";
import { parseAssetNodeId } from "@/lib/collection-node-id";
import { getColorName, normalizeHexColor } from "@/lib/color-names";
import {
  normalizeColorGradient,
  type StoredColorGradient,
} from "@/lib/color-gradient";
import { calculateNoteMetrics } from "@/lib/note-metrics";
import { first } from "@/lib/query";
import type { IObjectStorageService } from "@/services/object-storage.service";
import {
  getResourceMediaLookup,
  projectLinkNode,
} from "@/services/url-unfurl/projection";

type Deps = {
  objectStorageService: IObjectStorageService;
  resourceLifecycle?: {
    markResourceUnreferencedIfNeeded(resourceId: number): Promise<void>;
  };
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
  getPeekableAsset(
    orgId: string,
    assetNodeId: string,
  ): Promise<CollectionNoteNode | CollectionColorNode>;
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
  createInboxColor(
    orgId: string,
    userId: string,
    data: CreateColorInput,
  ): Promise<CollectionColorNode>;
  updateNote(
    orgId: string,
    userId: string,
    assetNodeId: string,
    data: UpdateNoteInput,
  ): Promise<UpdatedNote>;
  updateColor(
    orgId: string,
    userId: string,
    assetNodeId: string,
    data: UpdateColorInput,
  ): Promise<UpdatedColor>;
  updateImage(
    orgId: string,
    userId: string,
    assetNodeId: string,
    data: UpdateImageInput,
  ): Promise<UpdatedImage>;
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
  private readonly resourceLifecycle: Deps["resourceLifecycle"];

  constructor({ objectStorageService, resourceLifecycle }: Deps) {
    this.objectStorageService = objectStorageService;
    this.resourceLifecycle = resourceLifecycle;
  }

  async getPeekableAsset(
    orgId: string,
    assetNodeId: string,
  ): Promise<CollectionNoteNode | CollectionColorNode> {
    const target = parseAssetNodeId(assetNodeId);
    if (target.assetType !== "note" && target.assetType !== "color") {
      throw new AppError(ErrorCode.NOT_FOUND, "Asset not found");
    }
    if (target.assetType === "note") {
      const row = first(
        await db
          .select({
            id: assets.id,
            content: noteAssets.markdown,
            color: noteAssets.color,
            isFavorite: assets.isFavorite,
            createdAt: assets.createdAt,
            updatedAt: assets.updatedAt,
          })
          .from(assets)
          .innerJoin(noteAssets, eq(noteAssets.assetId, assets.id))
          .where(
            and(
              eq(assets.organizationId, orgId),
              eq(assets.id, target.entityId),
              eq(assets.type, "note"),
            ),
          )
          .limit(1),
      );
      if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Note not found");
      return {
        id: `note-${row.id}`,
        type: "note",
        content: row.content,
        color: row.color,
        isFavorite: row.isFavorite,
        ...calculateNoteMetrics(row.content),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        position: null,
      };
    }
    const row = first(
      await db
        .select({
          id: assets.id,
          hex: colorAssets.hex,
          gradient: colorAssets.gradient,
          title: assets.title,
          isFavorite: assets.isFavorite,
          createdAt: assets.createdAt,
        })
        .from(assets)
        .innerJoin(colorAssets, eq(colorAssets.assetId, assets.id))
        .where(
          and(
            eq(assets.organizationId, orgId),
            eq(assets.id, target.entityId),
            eq(assets.type, "color"),
          ),
        )
        .limit(1),
    );
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, "Color not found");
    return {
      id: `color-${row.id}`,
      type: "color",
      hex: row.hex,
      gradient: row.gradient,
      title: row.title,
      isFavorite: row.isFavorite,
      createdAt: row.createdAt.toISOString(),
      position: null,
    };
  }

  async getInboxContents(
    orgId: string,
    types?: ContentTypeFilter[],
  ): Promise<InboxContentsResponse> {
    const assetTypes = types?.filter(
      (type): type is "image" | "note" | "link" | "color" => type !== "folder",
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
        updatedAt: assets.updatedAt,
        imageAlt: imageAssets.alt,
        imageNote: imageAssets.note,
        sourceLabel: imageAssets.sourceLabel,
        sourceUrl: imageAssets.sourceUrl,
        imageVariants: imageAssets.variants,
        imageBlurDataURL: imageAssets.blurDataURL,
        imageDominantColors: imageAssets.dominantColors,
        noteContent: noteAssets.markdown,
        noteColor: noteAssets.color,
        colorHex: colorAssets.hex,
        colorGradient: colorAssets.gradient,
        linkOriginalUrl: linkAssets.originalUrl,
        linkResourceId: externalResources.id,
        linkHostname: externalResources.hostname,
        linkCanonicalUrl: externalResources.canonicalUrl,
        linkTitle: externalResources.title,
        linkDescription: externalResources.description,
        linkSiteName: externalResources.siteName,
        linkResourceKind: externalResources.resourceKind,
        linkResolutionStatus: externalResources.resolutionStatus,
        linkFailureCategory: externalResources.failureCategory,
        linkResolvedAt: externalResources.resolvedAt,
        linkStaleAt: externalResources.staleAt,
      })
      .from(assets)
      .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
      .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
      .leftJoin(colorAssets, eq(colorAssets.assetId, assets.id))
      .leftJoin(linkAssets, eq(linkAssets.assetId, assets.id))
      .leftJoin(
        externalResources,
        eq(externalResources.id, linkAssets.resourceId),
      )
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

  async createInboxColor(
    orgId: string,
    userId: string,
    data: CreateColorInput,
  ): Promise<CollectionColorNode> {
    const hex = normalizeHexColor(data.hex);
    const gradient = data.gradient
      ? normalizeColorGradient(data.gradient)
      : null;
    const title = gradient ? null : getColorName(hex);
    const color = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          organizationId: orgId,
          type: "color",
          title,
          lastAddedToInboxAt: new Date(),
          createdByUserId: userId,
          updatedByUserId: userId,
        })
        .returning();
      if (!asset)
        throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create color");
      await tx.insert(colorAssets).values({ assetId: asset.id, hex, gradient });
      return asset;
    });
    return {
      id: `color-${color.id}`,
      type: "color",
      hex,
      gradient,
      title,
      isFavorite: false,
      createdAt: color.createdAt.toISOString(),
      position: null,
    };
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
      updatedAt: note.updatedAt.toISOString(),
      position: null,
    };
  }

  async updateNote(
    orgId: string,
    userId: string,
    assetNodeId: string,
    data: UpdateNoteInput,
  ): Promise<UpdatedNote> {
    const target = parseAssetNodeId(assetNodeId);
    if (target.assetType !== "note") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Asset is not a note");
    }

    const updated = await db.transaction(async (tx) => {
      const [asset] = await tx
        .update(assets)
        .set({ updatedByUserId: userId })
        .where(
          and(
            eq(assets.id, target.entityId),
            eq(assets.organizationId, orgId),
            eq(assets.type, "note"),
          ),
        )
        .returning({
          id: assets.id,
          isFavorite: assets.isFavorite,
          updatedAt: assets.updatedAt,
        });

      if (!asset) {
        throw new AppError(ErrorCode.NOT_FOUND, "Note not found");
      }

      const [note] = await tx
        .update(noteAssets)
        .set({ markdown: data.content })
        .where(eq(noteAssets.assetId, asset.id))
        .returning({ color: noteAssets.color });

      if (!note) {
        throw new AppError(ErrorCode.NOT_FOUND, "Note not found");
      }

      return { ...asset, color: note.color };
    });

    const metrics = calculateNoteMetrics(data.content);

    return {
      id: `note-${updated.id}`,
      type: "note",
      content: data.content,
      color: updated.color,
      isFavorite: updated.isFavorite,
      ...metrics,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async updateColor(
    orgId: string,
    userId: string,
    assetNodeId: string,
    data: UpdateColorInput,
  ): Promise<UpdatedColor> {
    const target = parseAssetNodeId(assetNodeId);
    if (target.assetType !== "color") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Asset is not a color");
    }

    const hex = normalizeHexColor(data.hex);
    const gradient = data.gradient
      ? normalizeColorGradient(data.gradient)
      : data.gradient === null
        ? null
        : undefined;
    const title = gradient === null ? getColorName(hex) : null;
    const updated = await db.transaction(async (tx) => {
      const [asset] = await tx
        .update(assets)
        .set({ title, updatedByUserId: userId })
        .where(
          and(
            eq(assets.id, target.entityId),
            eq(assets.organizationId, orgId),
            eq(assets.type, "color"),
          ),
        )
        .returning({ id: assets.id, isFavorite: assets.isFavorite });
      if (!asset) {
        throw new AppError(ErrorCode.NOT_FOUND, "Color not found");
      }

      await tx
        .update(colorAssets)
        .set({ hex, ...(gradient === undefined ? {} : { gradient }) })
        .where(eq(colorAssets.assetId, asset.id));

      return asset;
    });

    return {
      id: `color-${updated.id}`,
      type: "color",
      hex,
      title,
      isFavorite: updated.isFavorite,
      gradient: gradient === undefined ? null : gradient,
    };
  }

  async updateImage(
    orgId: string,
    userId: string,
    assetNodeId: string,
    data: UpdateImageInput,
  ): Promise<UpdatedImage> {
    const target = parseAssetNodeId(assetNodeId);
    if (target.assetType !== "image") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Asset is not an image");
    }

    const note = data.note?.trim() ? data.note : null;
    const updated = await db.transaction(async (tx) => {
      const [asset] = await tx
        .update(assets)
        .set({ updatedByUserId: userId })
        .where(
          and(
            eq(assets.id, target.entityId),
            eq(assets.organizationId, orgId),
            eq(assets.type, "image"),
          ),
        )
        .returning({
          id: assets.id,
          isFavorite: assets.isFavorite,
          updatedAt: assets.updatedAt,
        });

      if (!asset) {
        throw new AppError(ErrorCode.NOT_FOUND, "Image not found");
      }

      const [image] = await tx
        .update(imageAssets)
        .set({ note })
        .where(eq(imageAssets.assetId, asset.id))
        .returning({ note: imageAssets.note });

      if (!image) {
        throw new AppError(ErrorCode.NOT_FOUND, "Image not found");
      }

      return { ...asset, note: image.note };
    });

    return {
      id: `image-${updated.id}`,
      type: "image",
      note: updated.note,
      isFavorite: updated.isFavorite,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteAsset(
    orgId: string,
    assetNodeId: string,
  ): Promise<{ deletedAssetId: string }> {
    const target = parseAssetNodeId(assetNodeId);
    const assetId = target.entityId;
    const resourceId =
      target.assetType === "link"
        ? first(
            await db
              .select({ resourceId: linkAssets.resourceId })
              .from(linkAssets)
              .where(
                and(
                  eq(linkAssets.organizationId, orgId),
                  eq(linkAssets.assetId, assetId),
                ),
              )
              .limit(1),
          )?.resourceId
        : undefined;

    if (target.assetType === "image") {
      const keys = await collectAssetObjectKeys(orgId, [assetId]);
      if (keys.length > 0) {
        await this.objectStorageService.deleteObjects(keys);
      }
    }

    await db
      .delete(assets)
      .where(and(eq(assets.organizationId, orgId), eq(assets.id, assetId)));

    if (resourceId) {
      await this.resourceLifecycle?.markResourceUnreferencedIfNeeded(
        resourceId,
      );
    }

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
    const linkAssetIds = parsed
      .filter((p) => p.parsed.assetType === "link")
      .map((p) => p.parsed.entityId);
    const resourceIds =
      linkAssetIds.length > 0
        ? (
            await db
              .select({ resourceId: linkAssets.resourceId })
              .from(linkAssets)
              .where(
                and(
                  eq(linkAssets.organizationId, orgId),
                  inArray(linkAssets.assetId, linkAssetIds),
                ),
              )
          ).map((row) => row.resourceId)
        : [];

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

    for (const resourceId of new Set(resourceIds)) {
      await this.resourceLifecycle?.markResourceUnreferencedIfNeeded(
        resourceId,
      );
    }

    return {
      deletedCount: parsed.length,
      deletedAssetCount: parsed.length,
    };
  }

  private async rowsToAssetNodes(
    rows: Array<{
      assetId: number;
      assetType: "image" | "note" | "link" | "color";
      title: string | null;
      isFavorite: boolean;
      createdAt: Date;
      updatedAt: Date;
      imageAlt: string | null;
      imageNote: string | null;
      sourceLabel: string | null;
      sourceUrl: string | null;
      imageVariants: ImageAssetVariants | null;
      imageBlurDataURL: string | null;
      imageDominantColors: string[] | null;
      noteContent: string | null;
      noteColor: string | null;
      colorHex: string | null;
      colorGradient: StoredColorGradient | null;
      linkOriginalUrl: string | null;
      linkResourceId: number | null;
      linkHostname: string | null;
      linkCanonicalUrl: string | null;
      linkTitle: string | null;
      linkDescription: string | null;
      linkSiteName: string | null;
      linkResourceKind: string | null;
      linkResolutionStatus: CollectionLinkNode["resolutionStatus"] | null;
      linkFailureCategory: string | null;
      linkResolvedAt: Date | null;
      linkStaleAt: Date | null;
    }>,
  ): Promise<CollectionNode[]> {
    const nodes: CollectionNode[] = [];
    const resourceMedia = await getResourceMediaLookup(
      rows.flatMap((row) =>
        row.assetType === "link" && row.linkResourceId
          ? [row.linkResourceId]
          : [],
      ),
      this.objectStorageService,
    );

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
          note: row.imageNote,
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

      if (
        row.assetType === "link" &&
        row.linkOriginalUrl &&
        row.linkResourceId &&
        row.linkHostname &&
        row.linkResolutionStatus
      ) {
        nodes.push(
          projectLinkNode(
            {
              assetId: row.assetId,
              originalUrl: row.linkOriginalUrl,
              resourceId: row.linkResourceId,
              hostname: row.linkHostname,
              canonicalUrl: row.linkCanonicalUrl,
              resourceTitle: row.linkTitle,
              description: row.linkDescription,
              siteName: row.linkSiteName,
              resourceKind: row.linkResourceKind ?? "web_page",
              resolutionStatus: row.linkResolutionStatus,
              failureCategory: row.linkFailureCategory,
              resolvedAt: row.linkResolvedAt,
              staleAt: row.linkStaleAt,
              createdAt: row.createdAt,
            },
            resourceMedia.get(row.linkResourceId),
            null,
          ),
        );
        continue;
      }

      if (row.assetType === "color" && row.colorHex) {
        nodes.push({
          id: `color-${row.assetId}`,
          type: "color",
          hex: row.colorHex,
          gradient: row.colorGradient ?? null,
          title: row.title,
          isFavorite: row.isFavorite,
          createdAt: row.createdAt.toISOString(),
          position: null,
        } satisfies CollectionColorNode);
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
        updatedAt: row.updatedAt.toISOString(),
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
