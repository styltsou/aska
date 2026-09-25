import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionNodes,
  collectionsTable,
  colorAssets,
  externalResourceMedia,
  externalResources,
  folders,
  imageAssets,
  linkAssets,
  noteAssets,
} from "@/db/schema";
import type {
  WorkspaceSearchQuery,
  WorkspaceSearchResponse,
  WorkspaceSearchResult,
} from "@/dto/workspace-search.dto";
import type { IObjectStorageService } from "@/services/object-storage.service";

type Deps = {
  objectStorageService: IObjectStorageService;
};

export interface IWorkspaceSearchService {
  search(
    orgId: string,
    query: WorkspaceSearchQuery,
  ): Promise<WorkspaceSearchResponse>;
}

type RankedResult = WorkspaceSearchResult & {
  rank: number;
  updatedAt: Date;
};

export class WorkspaceSearchService implements IWorkspaceSearchService {
  private readonly objectStorageService: IObjectStorageService;

  constructor({ objectStorageService }: Deps) {
    this.objectStorageService = objectStorageService;
  }

  async search(
    orgId: string,
    query: WorkspaceSearchQuery,
  ): Promise<WorkspaceSearchResponse> {
    const normalizedQuery = query.q.trim();
    const [assetResults, folderResults, collectionResults] = await Promise.all([
      searchAssets(
        orgId,
        normalizedQuery,
        query.limit,
        query.recent,
        this.objectStorageService,
      ),
      searchFolders(orgId, normalizedQuery, query.limit),
      searchCollections(orgId, normalizedQuery, query.limit),
    ]);

    const results = [...assetResults, ...folderResults, ...collectionResults]
      .sort(
        (left, right) =>
          left.rank - right.rank ||
          right.updatedAt.getTime() - left.updatedAt.getTime() ||
          left.label.localeCompare(right.label),
      )
      .slice(0, query.limit)
      .map(({ rank: _rank, updatedAt: _updatedAt, ...result }) => result);

    return { query: normalizedQuery, results };
  }
}

async function searchAssets(
  orgId: string,
  query: string,
  limit: number,
  recentAssetNodeIds: readonly string[],
  objectStorageService: IObjectStorageService,
): Promise<RankedResult[]> {
  const match = `%${query}%`;
  const prefix = `${query}%`;
  const recentAssetRanks = getRecentAssetRanks(query ? [] : recentAssetNodeIds);
  const recentOrder =
    recentAssetRanks.size > 0
      ? sql<number>`case ${sql.join(
          [...recentAssetRanks].map(
            ([assetId, index]) =>
              sql`when ${assets.id} = ${assetId} then ${index}`,
          ),
          sql` `,
        )} else ${recentAssetRanks.size} end`
      : sql<number>`0`;
  const activityRank = sql<number>`case
    when ${assets.updatedAt} > ${assets.createdAt} then 0
    else 1
  end`;
  const label = sql<string>`coalesce(
    nullif(trim(${assets.title}), ''),
    nullif(trim(${externalResources.title}), ''),
    nullif(trim(${externalResources.hostname}), ''),
    nullif(trim(${colorAssets.hex}), ''),
    case
      when ${assets.type} = 'image' then 'Untitled image'
      when ${assets.type} = 'note' then 'Untitled note'
      else 'Untitled'
    end
  )`;
  const rank = sql<number>`case
    when lower(${label}) = lower(${query}) then 0
    when ${label} ilike ${prefix} then 1
    when ${label} ilike ${match} then 2
    else 3
  end`;
  const rows = await db
    .select({
      assetId: assets.id,
      assetType: assets.type,
      title: assets.title,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      noteContent: noteAssets.markdown,
      imageAlt: imageAssets.alt,
      imageNote: imageAssets.note,
      imageBlurDataURL: imageAssets.blurDataURL,
      imageVariants: imageAssets.variants,
      colorHex: colorAssets.hex,
      linkOriginalUrl: linkAssets.originalUrl,
      linkResourceId: linkAssets.resourceId,
      linkNote: linkAssets.note,
      linkHostname: externalResources.hostname,
      linkTitle: externalResources.title,
      linkDescription: externalResources.description,
      linkSiteName: externalResources.siteName,
      linkResourceKind: externalResources.resourceKind,
      linkResolverKey: externalResources.resolverKey,
      collectionName: collectionsTable.name,
      collectionSlug: collectionsTable.slug,
      pathFolderNames: collectionNodes.pathFolderNames,
      pathFolderSlugs: collectionNodes.pathFolderSlugs,
      rank,
    })
    .from(assets)
    .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
    .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
    .leftJoin(colorAssets, eq(colorAssets.assetId, assets.id))
    .leftJoin(linkAssets, eq(linkAssets.assetId, assets.id))
    .leftJoin(
      externalResources,
      eq(externalResources.id, linkAssets.resourceId),
    )
    .leftJoin(collectionNodes, eq(collectionNodes.assetId, assets.id))
    .leftJoin(
      collectionsTable,
      eq(collectionsTable.id, collectionNodes.collectionId),
    )
    .where(
      and(
        eq(assets.organizationId, orgId),
        query
          ? or(
              ilike(label, match),
              ilike(noteAssets.markdown, match),
              ilike(imageAssets.alt, match),
              ilike(imageAssets.note, match),
              ilike(linkAssets.originalUrl, match),
              ilike(linkAssets.note, match),
              ilike(externalResources.description, match),
              ilike(externalResources.siteName, match),
            )
          : undefined,
      ),
    )
    .orderBy(
      query ? asc(rank) : asc(recentOrder),
      query ? desc(assets.updatedAt) : asc(activityRank),
      desc(assets.updatedAt),
    )
    .limit(limit);

  const imageVariantKeys = new Map<number, string>();
  for (const row of rows) {
    if (row.assetType !== "image") continue;
    const variant =
      row.imageVariants?.preview ??
      row.imageVariants?.display ??
      row.imageVariants?.original;
    if (variant?.objectKey)
      imageVariantKeys.set(row.assetId, variant.objectKey);
  }
  const linkResourceIds = rows.flatMap((row) =>
    row.assetType === "link" && row.linkResourceId ? [row.linkResourceId] : [],
  );
  const faviconRows = linkResourceIds.length
    ? await db
        .select({
          resourceId: externalResourceMedia.resourceId,
          variants: externalResourceMedia.variants,
        })
        .from(externalResourceMedia)
        .where(
          and(
            inArray(externalResourceMedia.resourceId, [
              ...new Set(linkResourceIds),
            ]),
            eq(externalResourceMedia.role, "icon"),
            eq(externalResourceMedia.status, "ready"),
          ),
        )
    : [];
  const faviconKeys = new Map<number, string>();
  for (const row of faviconRows) {
    const variant =
      row.variants.preview ?? row.variants.master ?? row.variants.display;
    if (variant?.objectKey) faviconKeys.set(row.resourceId, variant.objectKey);
  }
  const signedMedia = await objectStorageService.createPresignedGetUrls([
    ...imageVariantKeys.values(),
    ...faviconKeys.values(),
  ]);

  return rows.map((row) => {
    const type = row.assetType;
    const resultLabel =
      row.title?.trim() ||
      row.linkTitle?.trim() ||
      row.linkHostname?.trim() ||
      row.colorHex ||
      (type === "image"
        ? "Untitled image"
        : type === "note"
          ? "Untitled note"
          : "Untitled");
    const location = row.collectionSlug
      ? {
          type: "collection" as const,
          collectionSlug: row.collectionSlug,
          ...(row.pathFolderSlugs?.length
            ? { folderPath: row.pathFolderSlugs.join("/") }
            : {}),
        }
      : ({ type: "inbox" } as const);
    const isVideo =
      type === "link" &&
      ["youtube-oembed", "youtube-data-api"].includes(
        row.linkResolverKey ?? "",
      ) &&
      row.linkResourceKind === "video";
    const imageVariantKey = imageVariantKeys.get(row.assetId);
    const imageUrl = imageVariantKey
      ? signedMedia.get(imageVariantKey)?.url
      : undefined;
    const faviconKey = row.linkResourceId
      ? faviconKeys.get(row.linkResourceId)
      : undefined;
    const faviconUrl = faviconKey
      ? signedMedia.get(faviconKey)?.url
      : undefined;
    return {
      id: `${type}-${row.assetId}`,
      type,
      label: resultLabel,
      snippet: getAssetSnippet(row, query),
      locationLabel:
        row.pathFolderNames?.at(-1) ?? row.collectionName ?? "Inbox",
      location,
      action:
        type === "link" && !isVideo
          ? ({
              type: "external" as const,
              url: row.linkOriginalUrl ?? "",
            } as const)
          : ({ type: "open-asset" as const } as const),
      preview:
        type === "color" && row.colorHex
          ? { hex: row.colorHex }
          : type === "image" && (imageUrl || row.imageBlurDataURL)
            ? {
                ...(imageUrl ? { url: imageUrl } : {}),
                ...(row.imageBlurDataURL
                  ? { blurDataURL: row.imageBlurDataURL }
                  : {}),
              }
            : type === "link" && row.linkHostname
              ? {
                  hostname: row.linkHostname,
                  ...(faviconUrl ? { faviconUrl } : {}),
                }
              : null,
      rank: query
        ? Number(row.rank)
        : recentAssetRanks.has(row.assetId)
          ? -100 + recentAssetRanks.get(row.assetId)!
          : row.updatedAt > row.createdAt
            ? 0
            : 1,
      updatedAt: row.updatedAt,
    } satisfies RankedResult;
  });
}

function getRecentAssetRanks(
  assetNodeIds: readonly string[],
): Map<number, number> {
  const ranks = new Map<number, number>();
  for (const assetNodeId of assetNodeIds) {
    const assetId = Number(assetNodeId.slice(assetNodeId.lastIndexOf("-") + 1));
    if (!Number.isSafeInteger(assetId) || ranks.has(assetId)) continue;
    ranks.set(assetId, ranks.size);
  }
  return ranks;
}

async function searchFolders(
  orgId: string,
  query: string,
  limit: number,
): Promise<RankedResult[]> {
  const match = `%${query}%`;
  const prefix = `${query}%`;
  const rank = sql<number>`case
    when lower(${folders.name}) = lower(${query}) then 0
    when ${folders.name} ilike ${prefix} then 1
    else 2
  end`;
  const rows = await db
    .select({
      id: folders.id,
      name: folders.name,
      updatedAt: folders.updatedAt,
      collectionName: collectionsTable.name,
      collectionSlug: collectionsTable.slug,
      pathFolderNames: collectionNodes.pathFolderNames,
      pathFolderSlugs: collectionNodes.pathFolderSlugs,
      rank,
    })
    .from(folders)
    .innerJoin(collectionNodes, eq(collectionNodes.folderId, folders.id))
    .innerJoin(
      collectionsTable,
      eq(collectionsTable.id, collectionNodes.collectionId),
    )
    .where(
      and(
        eq(folders.organizationId, orgId),
        isNotNull(collectionNodes.folderId),
        query ? ilike(folders.name, match) : undefined,
      ),
    )
    .orderBy(
      query ? asc(rank) : desc(folders.updatedAt),
      desc(folders.updatedAt),
    )
    .limit(limit);

  return rows.map((row) => ({
    id: `folder-${row.id}`,
    type: "folder",
    label: row.name,
    snippet: null,
    locationLabel: row.collectionName,
    location: {
      type: "collection",
      collectionSlug: row.collectionSlug,
      folderPath: row.pathFolderSlugs.join("/"),
    },
    action: { type: "navigate" },
    preview: null,
    rank: Number(row.rank),
    updatedAt: row.updatedAt,
  }));
}

async function searchCollections(
  orgId: string,
  query: string,
  limit: number,
): Promise<RankedResult[]> {
  const match = `%${query}%`;
  const prefix = `${query}%`;
  const rank = sql<number>`case
    when lower(${collectionsTable.name}) = lower(${query}) then 0
    when ${collectionsTable.name} ilike ${prefix} then 1
    when ${collectionsTable.name} ilike ${match} then 2
    else 3
  end`;
  const rows = await db
    .select({
      id: collectionsTable.id,
      name: collectionsTable.name,
      slug: collectionsTable.slug,
      description: collectionsTable.description,
      updatedAt: collectionsTable.updatedAt,
      rank,
    })
    .from(collectionsTable)
    .where(
      and(
        eq(collectionsTable.organizationId, orgId),
        query
          ? or(
              ilike(collectionsTable.name, match),
              ilike(collectionsTable.description, match),
            )
          : undefined,
      ),
    )
    .orderBy(
      query ? asc(rank) : desc(collectionsTable.updatedAt),
      desc(collectionsTable.updatedAt),
    )
    .limit(limit);

  return rows.map((row) => ({
    id: `collection-${row.id}`,
    type: "collection",
    label: row.name,
    snippet: row.description,
    locationLabel: "Collection",
    location: { type: "collection", collectionSlug: row.slug },
    action: { type: "navigate" },
    preview: null,
    rank: Number(row.rank),
    updatedAt: row.updatedAt,
  }));
}

function getAssetSnippet(
  row: {
    noteContent: string | null;
    imageAlt: string | null;
    imageNote: string | null;
    linkDescription: string | null;
    linkNote: string | null;
    linkSiteName: string | null;
  },
  query: string,
): string | null {
  const candidates = [
    row.noteContent,
    row.imageNote,
    row.imageAlt,
    row.linkNote,
    row.linkDescription,
    row.linkSiteName,
  ];
  const selected =
    candidates.find(
      (value) =>
        value && query && value.toLowerCase().includes(query.toLowerCase()),
    ) ?? candidates.find(Boolean);
  if (!selected) return null;
  return selected
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, " ")
    .replace(/!?(?:\[([^\]]*)\])\([^)]*\)/g, "$1")
    .replace(/[#>*_~`|\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}
