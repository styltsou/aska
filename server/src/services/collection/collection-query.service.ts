import {
  and,
  arrayOverlaps,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  collectionsTable,
  folders,
  imageAssets,
  member,
  noteAssets,
  organization,
  type ImageAssetVariants,
} from "@/db/schema";
import type {
  CollectionContentsResponse,
  CollectionNode,
  FolderChildPreview,
  LightCollection,
} from "@/dto/collection.dto";
import { AppError, ErrorCode } from "@/lib/errors";
import { calculateNoteMetrics } from "@/lib/note-metrics";
import { first } from "@/lib/query";
import type { IObjectStorageService } from "@/services/object-storage.service";
import type { DetailedCollectionRow, WorkspaceInfo } from "./collection.types";

type Deps = {
  objectStorageService: IObjectStorageService;
};

type ImageVariantLookup = Map<
  number,
  ImageAssetVariants & {
    original?: ImageAssetVariants["original"] & { url?: string };
    display?: ImageAssetVariants["display"] & { url?: string };
    preview?: ImageAssetVariants["preview"] & { url?: string };
    blurDataURL?: string | null;
  }
>;

export class CollectionQueryService {
  private readonly objectStorageService: IObjectStorageService;

  constructor(deps: Deps) {
    this.objectStorageService = deps.objectStorageService;
  }

  async getWorkspaceBySlug(
    slug: string,
    userId: string,
  ): Promise<WorkspaceInfo> {
    const org = first(
      await db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
        })
        .from(organization)
        .innerJoin(member, eq(member.organizationId, organization.id))
        .where(and(eq(organization.slug, slug), eq(member.userId, userId))),
    );

    if (!org) {
      throw new AppError(ErrorCode.NOT_FOUND, "Workspace not found");
    }

    return org;
  }

  async getLightCollections(orgId: string): Promise<LightCollection[]> {
    const rows = await db
      .select({
        id: collectionsTable.id,
        name: collectionsTable.name,
        slug: collectionsTable.slug,
        assetCount: sql<number>`
          (
            SELECT COUNT(*)
            FROM ${collectionNodes}
            WHERE ${collectionNodes.collectionId} = ${collectionsTable.id}
              AND ${collectionNodes.nodeType} = 'asset'
          )
        `,
      })
      .from(collectionsTable)
      .where(eq(collectionsTable.organizationId, orgId))
      .orderBy(collectionsTable.name);

    return rows.map((r) => ({
      ...r,
      assetCount: Number(r.assetCount),
    }));
  }

  async getDetailedCollections(
    orgId: string,
  ): Promise<DetailedCollectionRow[]> {
    const rows = await db
      .select({
        id: collectionsTable.id,
        name: collectionsTable.name,
        slug: collectionsTable.slug,
        description: collectionsTable.description,
        createdAt: collectionsTable.createdAt,
        updatedAt: collectionsTable.updatedAt,
        assetCount: sql<number>`
          (
            SELECT COUNT(*)
            FROM ${collectionNodes}
            WHERE ${collectionNodes.collectionId} = ${collectionsTable.id}
              AND ${collectionNodes.nodeType} = 'asset'
          )
        `,
      })
      .from(collectionsTable)
      .where(eq(collectionsTable.organizationId, orgId))
      .orderBy(collectionsTable.name);

    if (rows.length === 0) return [];

    const collectionIds = rows.map((r) => r.id);
    const previewRows = await db
      .select({
        collectionId: collectionNodes.collectionId,
        assetId: assets.id,
        assetType: assets.type,
        noteColor: noteAssets.color,
        noteContent: noteAssets.markdown,
      })
      .from(collectionNodes)
      .innerJoin(assets, eq(assets.id, collectionNodes.assetId))
      .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
      .where(
        and(
          inArray(collectionNodes.collectionId, collectionIds),
          eq(collectionNodes.nodeType, "asset"),
        ),
      )
      .orderBy(
        collectionNodes.collectionId,
        desc(collectionNodes.createdAt),
        desc(collectionNodes.id),
      );

    const selectedPreviewRows = firstPreviewRowsByParent(
      previewRows,
      (row) => row.collectionId,
    );
    const imageAssetIds = selectedPreviewRows
      .filter((row) => row.assetType === "image")
      .map((row) => row.assetId);
    const imageVariants = await this.getSignedImageVariantLookup(imageAssetIds);
    const previewMap = new Map<number, FolderChildPreview[]>();
    for (const row of selectedPreviewRows) {
      let preview: FolderChildPreview | undefined;

      if (row.assetType === "image") {
        const variants = imageVariants.get(row.assetId);
        const url = variants?.preview?.url;
        if (url)
          preview = {
            assetId: `image-${row.assetId}`,
            type: "image",
            url,
            blurDataURL: variants?.blurDataURL,
          };
      } else if (row.assetType === "note") {
        const snippet = row.noteContent
          ? makeSnippet(row.noteContent)
          : undefined;
        preview = {
          assetId: `note-${row.assetId}`,
          type: "note",
          color: row.noteColor ?? undefined,
          snippet,
        };
      }

      if (!preview) continue;

      const list = previewMap.get(row.collectionId);
      if (!list) {
        previewMap.set(row.collectionId, [preview]);
      } else if (list.length < 4) {
        list.push(preview);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      assetCount: Number(r.assetCount),
      previews: previewMap.get(r.id) ?? [],
    }));
  }

  async getCollectionContents(
    orgId: string,
    collectionSlug: string,
    folderPath?: string,
  ): Promise<CollectionContentsResponse> {
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

    const pathSlugs = folderPath ? folderPath.split("/").filter(Boolean) : [];
    let parentFolderId: number | null = null;
    let breadcrumbFolderIds: number[] = [];

    if (pathSlugs.length > 0) {
      const folderNode = first(
        await db
          .select({
            folderId: collectionNodes.folderId,
            pathFolderIds: collectionNodes.pathFolderIds,
            pathFolderNames: collectionNodes.pathFolderNames,
          })
          .from(collectionNodes)
          .where(
            and(
              eq(collectionNodes.collectionId, collection.id),
              eq(collectionNodes.pathFolderSlugs, pathSlugs),
              eq(collectionNodes.nodeType, "folder"),
            ),
          ),
      );

      if (!folderNode || !folderNode.folderId) {
        throw new AppError(
          ErrorCode.NOT_FOUND,
          "Folder not found in collection",
        );
      }

      parentFolderId = folderNode.folderId;
      breadcrumbFolderIds = folderNode.pathFolderIds;
    }

    const children = await db
      .select({
        nodeId: collectionNodes.id,
        nodeType: collectionNodes.nodeType,
        sortKey: collectionNodes.sortKey,
        assetId: assets.id,
        assetType: assets.type,
        title: assets.title,
        isFavorite: assets.isFavorite,
        imageAlt: imageAssets.alt,
        sourceLabel: imageAssets.sourceLabel,
        sourceUrl: imageAssets.sourceUrl,
        imageDominantColors: imageAssets.dominantColors,
        createdAt: collectionNodes.createdAt,
        noteContent: noteAssets.markdown,
        noteColor: noteAssets.color,
        folderId: folders.id,
        folderName: folders.name,
        folderSlug: folders.slug,
      })
      .from(collectionNodes)
      .leftJoin(assets, eq(assets.id, collectionNodes.assetId))
      .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
      .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
      .leftJoin(folders, eq(folders.id, collectionNodes.folderId))
      .where(
        and(
          eq(collectionNodes.collectionId, collection.id),
          parentFolderId !== null
            ? eq(collectionNodes.parentFolderId, parentFolderId)
            : isNull(collectionNodes.parentFolderId),
        ),
      )
      .orderBy(collectionNodes.sortKey);

    const folderChildIds = children
      .filter((c) => c.nodeType === "folder" && c.folderId !== null)
      .map((c) => c.folderId!);

    const countMap = new Map<number, number>();
    const previewMap = new Map<number, FolderChildPreview[]>();
    let folderPreviewRows: Array<{
      folderId: number | null;
      assetType: string | null;
      assetId: number | null;
      color: string | null;
      content: string | null;
    }> = [];

    if (folderChildIds.length > 0) {
      const countRows = await db
        .select({
          folderId: sql<number>`unnest(${collectionNodes.pathFolderIds})`,
          count: sql<number>`COUNT(*)`,
        })
        .from(collectionNodes)
        .where(
          and(
            eq(collectionNodes.collectionId, collection.id),
            eq(collectionNodes.nodeType, "asset"),
            arrayOverlaps(collectionNodes.pathFolderIds, folderChildIds),
          ),
        )
        .groupBy(sql`unnest(${collectionNodes.pathFolderIds})`);

      for (const row of countRows) {
        countMap.set(row.folderId!, Number(row.count));
      }

      const previewRows = await db
        .select({
          folderId: collectionNodes.parentFolderId,
          assetType: assets.type,
          assetId: assets.id,
          color: noteAssets.color,
          content: noteAssets.markdown,
        })
        .from(collectionNodes)
        .leftJoin(assets, eq(assets.id, collectionNodes.assetId))
        .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
        .where(
          and(
            eq(collectionNodes.collectionId, collection.id),
            inArray(collectionNodes.parentFolderId, folderChildIds),
            eq(collectionNodes.nodeType, "asset"),
          ),
        )
        .orderBy(desc(collectionNodes.createdAt), desc(collectionNodes.id));

      folderPreviewRows = previewRows;
    }

    const selectedFolderPreviewRows = firstPreviewRowsByParent(
      folderPreviewRows,
      (row) => row.folderId,
    );
    const imageAssetIds = [
      ...children
        .filter(
          (child) => child.assetType === "image" && child.assetId !== null,
        )
        .map((child) => child.assetId!),
      ...selectedFolderPreviewRows
        .filter((row) => row.assetType === "image" && row.assetId !== null)
        .map((row) => row.assetId!),
    ];
    const imageVariants = await this.getSignedImageVariantLookup(imageAssetIds);

    for (const row of selectedFolderPreviewRows) {
      if (!row.folderId) continue;
      const list = previewMap.get(row.folderId);
      const folderPreview = toPreview(row, imageVariants);
      if (!list) {
        previewMap.set(row.folderId, [folderPreview]);
      } else if (list.length < 4) {
        list.push(folderPreview);
      }
    }

    const nodes: CollectionNode[] = children.map((child) => {
      if (child.nodeType === "folder") {
        const fid = child.folderId!;
        return {
          id: `folder-${fid}`,
          type: "folder" as const,
          name: child.folderName!,
          slug: child.folderSlug!,
          count: countMap.get(fid) ?? 0,
          previews: previewMap.get(fid) ?? [],
        };
      }

      if (child.assetType === "image") {
        const variant = imageVariants.get(child.assetId!);
        const display = variant?.display;

        if (!display?.url) {
          throw new AppError(
            ErrorCode.INTERNAL_ERROR,
            "Image display variant is missing a signed URL",
          );
        }

        return {
          id: `image-${child.assetId}`,
          type: "image" as const,
          url: display.url,
          originalUrl: variant?.original?.url,
          originalWidth: variant?.original?.width,
          originalHeight: variant?.original?.height,
          width: display.width,
          height: display.height,
          title: child.title,
          alt: child.imageAlt,
          sourceLabel: child.sourceLabel,
          sourceUrl: child.sourceUrl,
          isFavorite: child.isFavorite ?? false,
          blurDataURL: variant?.blurDataURL,
          dominantColors: child.imageDominantColors ?? undefined,
          sizeBytes: variant?.display?.sizeBytes,
          createdAt: child.createdAt.toISOString(),
        };
      }

      const { wordCount, readingTimeMinutes } = calculateNoteMetrics(
        child.noteContent!,
      );

      return {
        id: `note-${child.assetId}`,
        type: "note" as const,
        content: child.noteContent!,
        color: child.noteColor,
        isFavorite: child.isFavorite ?? false,
        wordCount,
        readingTimeMinutes,
      };
    });

    let breadcrumbs: { id: number; name: string; slug: string }[] = [];

    if (breadcrumbFolderIds.length > 0 && pathSlugs.length > 0) {
      const breadcrumbFolders = await db
        .select({
          id: folders.id,
          name: folders.name,
          slug: folders.slug,
        })
        .from(folders)
        .where(inArray(folders.id, breadcrumbFolderIds))
        .orderBy(folders.id);

      const folderMap = new Map(breadcrumbFolders.map((f) => [f.id, f]));
      breadcrumbs = breadcrumbFolderIds
        .map((id) => folderMap.get(id))
        .filter((f): f is NonNullable<typeof f> => f !== undefined);
    }

    return {
      collection: {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
      },
      breadcrumbs,
      nodes,
    };
  }

  private async getSignedImageVariantLookup(
    assetIds: number[],
  ): Promise<ImageVariantLookup> {
    const uniqueAssetIds = [...new Set(assetIds)];
    if (uniqueAssetIds.length === 0) return new Map();

    const variants = await db
      .select({
        assetId: imageAssets.assetId,
        variants: imageAssets.variants,
        blurDataURL: imageAssets.blurDataURL,
      })
      .from(imageAssets)
      .where(inArray(imageAssets.assetId, uniqueAssetIds));

    const signed = await this.objectStorageService.createPresignedGetUrls(
      variants
        .flatMap((row) => [
          row.variants.display?.objectKey,
          row.variants.preview?.objectKey,
          row.variants.original?.objectKey,
        ])
        .filter((key): key is string => key !== undefined),
    );

    const lookup: ImageVariantLookup = new Map();
    for (const row of variants) {
      const display = row.variants.display;
      const preview = row.variants.preview;
      const original = row.variants.original;
      const displayUrl = display
        ? signed.get(display.objectKey)?.url
        : undefined;
      const previewUrl = preview
        ? signed.get(preview.objectKey)?.url
        : undefined;
      const originalUrl = original
        ? signed.get(original.objectKey)?.url
        : undefined;
      const lookupValue: ImageVariantLookup extends Map<number, infer Value>
        ? Value
        : never = {
        ...row.variants,
        blurDataURL: row.blurDataURL,
      };
      if (display) {
        lookupValue.display = displayUrl
          ? { ...display, url: displayUrl }
          : display;
      }
      if (preview) {
        lookupValue.preview = previewUrl
          ? { ...preview, url: previewUrl }
          : preview;
      }
      if (original) {
        lookupValue.original = originalUrl
          ? { ...original, url: originalUrl }
          : original;
      }
      lookup.set(row.assetId, lookupValue);
    }

    return lookup;
  }
}

function makeSnippet(content: string): string {
  const singleLine = content.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return singleLine.length > 1000
    ? singleLine.slice(0, 1000).trimEnd() + "…"
    : singleLine;
}

function toPreview(
  row: {
    assetType: string | null;
    assetId: number | null;
    color: string | null;
    content: string | null;
  },
  imageVariants: ImageVariantLookup,
): FolderChildPreview {
  const variants = row.assetId ? imageVariants.get(row.assetId) : undefined;
  const previewUrl = variants?.preview?.url;
  if (row.assetType === "image" && previewUrl) {
    return {
      assetId: `image-${row.assetId}`,
      type: "image",
      url: previewUrl,
      blurDataURL: variants?.blurDataURL,
    };
  }
  const snippet = row.content ? makeSnippet(row.content) : undefined;
  return {
    assetId: `note-${row.assetId}`,
    type: "note",
    color: row.color ?? undefined,
    snippet,
  };
}

function firstPreviewRowsByParent<T>(
  rows: T[],
  getParentId: (row: T) => number | null,
): T[] {
  const counts = new Map<number, number>();
  const selected: T[] = [];

  for (const row of rows) {
    const parentId = getParentId(row);
    if (parentId === null) continue;

    const count = counts.get(parentId) ?? 0;
    if (count >= 4) continue;

    counts.set(parentId, count + 1);
    selected.push(row);
  }

  return selected;
}
