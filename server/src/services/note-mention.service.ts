import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  collectionsTable,
  colorAssets,
  collectionNodes,
  externalResourceMedia,
  externalResources,
  imageAssets,
  videoAssets,
  linkAssets,
  noteAssets,
  noteReferences,
} from "@/db/schema";
import type {
  NoteBacklink,
  NoteBacklinksResponse,
  NoteBacklinkSummaryResponse,
  MentionResolveInput,
  MentionSearchQuery,
  MentionTarget,
  MentionTargetsResponse,
  MentionType,
} from "@/dto/note-mention.dto";
import { parseAssetNodeId } from "@/lib/collection-node-id";
import type { IObjectStorageService } from "@/services/object-storage.service";
import {
  escapeMentionLabel,
  extractNoteMentions,
  mentionKey,
  rewriteNoteMentionLabels,
} from "@/lib/note-mentions";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | DatabaseTransaction;
type Deps = { objectStorageService: IObjectStorageService };

type MentionRow = {
  assetId: number;
  assetType: "image" | "video" | "note" | "link" | "color";
  title: string | null;
  updatedAt: Date;
  markdown: string | null;
  hex: string | null;
  gradient: typeof colorAssets.$inferSelect.gradient | null;
  collectionName: string | null;
  collectionSlug: string | null;
  pathFolderNames: string[] | null;
  pathFolderSlugs: string[] | null;
  hostname: string | null;
  url: string | null;
  resourceId: number | null;
  resourceKind: string | null;
  resolverKey: string | null;
  imageVariants: typeof imageAssets.$inferSelect.variants | null;
  imageAlt: string | null;
  imageSourceLabel: string | null;
  videoPoster: typeof videoAssets.$inferSelect.poster | null;
  videoSourceLabel: string | null;
};

export interface INoteMentionService {
  search(
    orgId: string,
    query: MentionSearchQuery,
  ): Promise<MentionTargetsResponse>;
  resolve(
    orgId: string,
    input: MentionResolveInput,
  ): Promise<MentionTargetsResponse>;
  getBacklinkSummary(
    orgId: string,
    targetAssetNodeId: string,
  ): Promise<NoteBacklinkSummaryResponse>;
  listBacklinks(
    orgId: string,
    targetAssetNodeId: string,
  ): Promise<NoteBacklinksResponse>;
}

export class NoteMentionService implements INoteMentionService {
  private readonly objectStorageService: IObjectStorageService;

  constructor({ objectStorageService }: Deps) {
    this.objectStorageService = objectStorageService;
  }

  async search(
    orgId: string,
    query: MentionSearchQuery,
  ): Promise<MentionTargetsResponse> {
    const types = [
      ...new Set(
        query.types ??
          (["note", "color", "link", "image", "video"] as const),
      ),
    ];
    const normalizedQuery = query.q.trim();

    if (!normalizedQuery && types.length === 5) {
      const [notes, colors, links, images, videos] = await Promise.all([
        findMentionRows(orgId, ["note"], "", query.limit, query.sourceAssetId),
        findMentionRows(orgId, ["color"], "", query.limit, query.sourceAssetId),
        findMentionRows(orgId, ["link"], "", query.limit, query.sourceAssetId),
        findMentionRows(orgId, ["image"], "", query.limit, query.sourceAssetId),
        findMentionRows(orgId, ["video"], "", query.limit, query.sourceAssetId),
      ]);
      return {
        targets: await toTargets(
          orgId,
          balanceRecentTargets(
            [notes, colors, links, images, videos],
            query.limit,
          ),
          this.objectStorageService,
        ),
      };
    }

    const rows = await findMentionRows(
      orgId,
      [...types],
      normalizedQuery,
      query.limit,
      query.sourceAssetId,
    );
    return {
      targets: await toTargets(orgId, rows, this.objectStorageService),
    };
  }

  async resolve(
    orgId: string,
    input: MentionResolveInput,
  ): Promise<MentionTargetsResponse> {
    const requestedKeys = new Set(
      input.targets.map((target) =>
        mentionKey(target.assetType, target.assetId),
      ),
    );
    const requestedIds = [
      ...new Set(input.targets.map((target) => target.assetId)),
    ];
    if (requestedIds.length === 0) return { targets: [] };

    const rows = await selectMentionRows(db)
      .where(
        and(
          eq(assets.organizationId, orgId),
          inArray(assets.id, requestedIds),
          input.sourceAssetId ? ne(assets.id, input.sourceAssetId) : undefined,
        ),
      )
      .orderBy(asc(assets.id));

    const validTargets = rows.filter(
      (row) =>
        (row.assetType === "note" ||
          row.assetType === "color" ||
          row.assetType === "link" ||
          row.assetType === "image" ||
          row.assetType === "video") &&
        requestedKeys.has(
          mentionKey(row.assetType as MentionType, row.assetId),
        ),
    );
    return {
      targets: await toTargets(orgId, validTargets, this.objectStorageService),
    };
  }

  async getBacklinkSummary(
    orgId: string,
    targetAssetNodeId: string,
  ): Promise<NoteBacklinkSummaryResponse> {
    const targetAssetId = noteAssetId(targetAssetNodeId);
    const [result] = await db
      .select({ count: count() })
      .from(noteReferences)
      .where(
        and(
          eq(noteReferences.organizationId, orgId),
          eq(noteReferences.targetAssetId, targetAssetId),
        ),
      );
    return { count: result?.count ?? 0 };
  }

  async listBacklinks(
    orgId: string,
    targetAssetNodeId: string,
  ): Promise<NoteBacklinksResponse> {
    const targetAssetId = noteAssetId(targetAssetNodeId);
    const rows = await db
      .select({
        assetId: assets.id,
        title: assets.title,
        updatedAt: assets.updatedAt,
        collectionName: collectionsTable.name,
        pathFolderNames: collectionNodes.pathFolderNames,
      })
      .from(noteReferences)
      .innerJoin(
        assets,
        and(
          eq(assets.id, noteReferences.sourceAssetId),
          eq(assets.organizationId, noteReferences.organizationId),
        ),
      )
      .leftJoin(collectionNodes, eq(collectionNodes.assetId, assets.id))
      .leftJoin(
        collectionsTable,
        eq(collectionsTable.id, collectionNodes.collectionId),
      )
      .where(
        and(
          eq(noteReferences.organizationId, orgId),
          eq(noteReferences.targetAssetId, targetAssetId),
          eq(assets.type, "note"),
        ),
      )
      .orderBy(desc(assets.updatedAt), asc(assets.id));

    return {
      backlinks: rows.map(
        (row): NoteBacklink => ({
          assetId: `note-${row.assetId}`,
          title: row.title?.trim() || "Untitled",
          locationLabel:
            row.pathFolderNames?.at(-1) ?? row.collectionName ?? "Inbox",
          updatedAt: row.updatedAt.toISOString(),
        }),
      ),
    };
  }
}

function noteAssetId(assetNodeId: string) {
  const target = parseAssetNodeId(assetNodeId);
  if (target.assetType !== "note") {
    throw new Error("Backlinks are only available for notes");
  }
  return target.entityId;
}

export async function reconcileNoteReferences(
  tx: DatabaseTransaction,
  orgId: string,
  sourceAssetId: number,
  markdown: string,
): Promise<string> {
  const parsed = extractNoteMentions(markdown);
  const requestedKeys = new Set<string>();
  const requestedIds = new Set<number>();
  for (const mention of parsed) {
    if (mention.targetAssetId !== sourceAssetId) {
      requestedKeys.add(mentionKey(mention.targetType, mention.targetAssetId));
      requestedIds.add(mention.targetAssetId);
    }
  }

  const rows = requestedIds.size
    ? await selectMentionRows(tx).where(
        and(
          eq(assets.organizationId, orgId),
          inArray(assets.id, [...requestedIds]),
          ne(assets.id, sourceAssetId),
        ),
      )
    : [];
  const validTargets = rows.filter(
    (row) =>
      (row.assetType === "note" ||
        row.assetType === "color" ||
        row.assetType === "link" ||
        row.assetType === "image" || row.assetType === "video") &&
      requestedKeys.has(mentionKey(row.assetType as MentionType, row.assetId)),
  );
  const replacements = new Map(
    validTargets.map((row) => [
      mentionKey(row.assetType as MentionType, row.assetId),
      mentionLabel(row),
    ]),
  );
  const canonicalMarkdown = rewriteNoteMentionLabels(markdown, replacements);
  const canonicalMentions = extractNoteMentions(canonicalMarkdown);
  const desired = new Map<
    number,
    { targetType: MentionType; fallbackLabel: string }
  >();
  const validKeys = new Set(replacements.keys());
  for (const mention of canonicalMentions) {
    if (
      mention.targetAssetId !== sourceAssetId &&
      validKeys.has(mentionKey(mention.targetType, mention.targetAssetId))
    ) {
      desired.set(mention.targetAssetId, {
        targetType: mention.targetType,
        fallbackLabel: escapeMentionLabel(mention.fallbackLabel),
      });
    }
  }

  const existing = await tx
    .select({
      targetAssetId: noteReferences.targetAssetId,
      targetType: noteReferences.targetType,
      fallbackLabel: noteReferences.fallbackLabel,
    })
    .from(noteReferences)
    .where(
      and(
        eq(noteReferences.organizationId, orgId),
        eq(noteReferences.sourceAssetId, sourceAssetId),
      ),
    );
  const existingById = new Map(existing.map((row) => [row.targetAssetId, row]));
  const removedIds = existing
    .filter((row) => !desired.has(row.targetAssetId))
    .map((row) => row.targetAssetId);
  if (removedIds.length > 0) {
    await tx
      .delete(noteReferences)
      .where(
        and(
          eq(noteReferences.organizationId, orgId),
          eq(noteReferences.sourceAssetId, sourceAssetId),
          inArray(noteReferences.targetAssetId, removedIds),
        ),
      );
  }

  for (const [targetAssetId, reference] of desired) {
    const current = existingById.get(targetAssetId);
    if (!current) {
      await tx.insert(noteReferences).values({
        organizationId: orgId,
        sourceAssetId,
        targetAssetId,
        targetType: reference.targetType,
        fallbackLabel: reference.fallbackLabel,
      });
    } else if (
      current.targetType !== reference.targetType ||
      current.fallbackLabel !== reference.fallbackLabel
    ) {
      await tx
        .update(noteReferences)
        .set(reference)
        .where(
          and(
            eq(noteReferences.organizationId, orgId),
            eq(noteReferences.sourceAssetId, sourceAssetId),
            eq(noteReferences.targetAssetId, targetAssetId),
          ),
        );
    }
  }
  return canonicalMarkdown;
}

export async function rewriteReferencedTargetLabel(
  tx: DatabaseTransaction,
  orgId: string,
  targetAssetId: number,
  targetType: MentionType,
  label: string | null,
) {
  if (!label) return;
  const canonicalLabel = escapeMentionLabel(label);
  const sourceRows = await tx
    .select({
      sourceAssetId: noteReferences.sourceAssetId,
      markdown: noteAssets.markdown,
    })
    .from(noteReferences)
    .innerJoin(noteAssets, eq(noteAssets.assetId, noteReferences.sourceAssetId))
    .where(
      and(
        eq(noteReferences.organizationId, orgId),
        eq(noteReferences.targetAssetId, targetAssetId),
        eq(noteReferences.targetType, targetType),
      ),
    );
  const replacements = new Map([
    [mentionKey(targetType, targetAssetId), canonicalLabel],
  ]);
  for (const source of sourceRows) {
    const markdown = rewriteNoteMentionLabels(source.markdown, replacements);
    if (markdown !== source.markdown) {
      await tx
        .update(noteAssets)
        .set({ markdown })
        .where(eq(noteAssets.assetId, source.sourceAssetId));
    }
  }
  await tx
    .update(noteReferences)
    .set({ fallbackLabel: canonicalLabel })
    .where(
      and(
        eq(noteReferences.organizationId, orgId),
        eq(noteReferences.targetAssetId, targetAssetId),
        eq(noteReferences.targetType, targetType),
      ),
    );
}

function selectMentionRows(executor: Executor) {
  return executor
    .select({
      assetId: assets.id,
      assetType: assets.type,
      title: assets.title,
      updatedAt: assets.updatedAt,
      markdown: noteAssets.markdown,
      hex: colorAssets.hex,
      gradient: colorAssets.gradient,
      collectionName: collectionsTable.name,
      collectionSlug: collectionsTable.slug,
      pathFolderNames: collectionNodes.pathFolderNames,
      pathFolderSlugs: collectionNodes.pathFolderSlugs,
      hostname: externalResources.hostname,
      url: linkAssets.originalUrl,
      resourceId: linkAssets.resourceId,
      resourceKind: externalResources.resourceKind,
      resolverKey: externalResources.resolverKey,
      imageVariants: imageAssets.variants,
      imageAlt: imageAssets.alt,
      imageSourceLabel: imageAssets.sourceLabel,
      videoPoster: videoAssets.poster,
      videoSourceLabel: videoAssets.sourceLabel,
    })
    .from(assets)
    .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
    .leftJoin(colorAssets, eq(colorAssets.assetId, assets.id))
    .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
    .leftJoin(videoAssets, eq(videoAssets.assetId, assets.id))
    .leftJoin(linkAssets, eq(linkAssets.assetId, assets.id))
    .leftJoin(
      externalResources,
      and(
        eq(externalResources.id, linkAssets.resourceId),
        eq(externalResources.organizationId, assets.organizationId),
      ),
    )
    .leftJoin(collectionNodes, eq(collectionNodes.assetId, assets.id))
    .leftJoin(
      collectionsTable,
      eq(collectionsTable.id, collectionNodes.collectionId),
    );
}

async function findMentionRows(
  orgId: string,
  types: MentionType[],
  query: string,
  limit: number,
  sourceAssetId?: number,
): Promise<MentionRow[]> {
  const match = `%${query}%`;
  const score = sql<number>`case
    when lower(coalesce(${assets.title}, '')) = lower(${query}) then 0
    when ${assets.title} ilike ${`${query}%`} then 1
    when ${assets.title} ilike ${match} then 2
    else 3 end`;
  return selectMentionRows(db)
    .where(
      and(
        eq(assets.organizationId, orgId),
        inArray(assets.type, types),
        sourceAssetId ? ne(assets.id, sourceAssetId) : undefined,
        or(
          eq(assets.type, "color"),
          eq(assets.type, "link"),
          eq(assets.type, "image"),
          eq(assets.type, "video"),
          isNotNull(assets.title),
        ),
        query
          ? or(
              ilike(assets.title, match),
              and(
                eq(assets.type, "link"),
                or(
                  ilike(externalResources.hostname, match),
                  ilike(linkAssets.originalUrl, match),
                ),
              ),
              and(
                eq(assets.type, "color"),
                or(
                  ilike(colorAssets.hex, match),
                  sql`lower(coalesce(${colorAssets.gradient}->>'type', '') || ' gradient') like lower(${match})`,
                ),
              ),
              and(
                eq(assets.type, "image"),
                or(
                  ilike(imageAssets.alt, match),
                  ilike(imageAssets.sourceLabel, match),
                ),
              ),
              and(
                eq(assets.type, "video"),
                or(
                  ilike(videoAssets.sourceLabel, match),
                  ilike(videoAssets.note, match),
                ),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(
      query ? asc(score) : desc(assets.updatedAt),
      desc(assets.updatedAt),
      asc(assets.id),
    )
    .limit(limit);
}

function balanceRecentTargets(
  groups: MentionRow[][],
  limit: number,
): MentionRow[] {
  const selected = groups.flatMap((group) => group.slice(0, 2));
  const selectedIds = new Set(selected.map((row) => row.assetId));
  const remaining = groups
    .flat()
    .filter((row) => !selectedIds.has(row.assetId))
    .sort(
      (left, right) =>
        right.updatedAt.getTime() - left.updatedAt.getTime() ||
        left.assetId - right.assetId,
    );
  return [...selected, ...remaining].slice(0, limit);
}

async function toTargets(
  orgId: string,
  rows: MentionRow[],
  objectStorageService: IObjectStorageService,
): Promise<MentionTarget[]> {
  const resourceIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.assetType === "link" && row.resourceId ? [row.resourceId] : [],
      ),
    ),
  ];
  const mediaByResource = new Map<
    number,
    { preview?: string; icon?: string }
  >();
  const imageKeysByAsset = new Map<number, string>();
  const videoKeysByAsset = new Map<number, string>();
  for (const row of rows) {
    if (row.assetType === "image") {
      const key =
        row.imageVariants?.preview?.objectKey ??
        row.imageVariants?.display?.objectKey;
      if (key) imageKeysByAsset.set(row.assetId, key);
    } else if (row.assetType === "video") {
      const key =
        row.videoPoster?.preview?.objectKey ??
        row.videoPoster?.display?.objectKey;
      if (key) videoKeysByAsset.set(row.assetId, key);
    }
  }
  const previewKeysByAsset = new Map([
    ...imageKeysByAsset,
    ...videoKeysByAsset,
  ]);
  const imageKeys = [...new Set(previewKeysByAsset.values())];
  const signedImages =
    imageKeys.length > 0
      ? await objectStorageService.createPresignedGetUrls(imageKeys)
      : new Map();
  if (resourceIds.length > 0) {
    const mediaRows = await db
      .select({
        resourceId: externalResourceMedia.resourceId,
        role: externalResourceMedia.role,
        variants: externalResourceMedia.variants,
      })
      .from(externalResourceMedia)
      .where(
        and(
          inArray(externalResourceMedia.resourceId, resourceIds),
          eq(externalResourceMedia.organizationId, orgId),
          inArray(externalResourceMedia.role, ["preview", "icon"]),
          eq(externalResourceMedia.status, "ready"),
        ),
      );
    const keysByResource = new Map<
      number,
      { preview?: string; icon?: string }
    >();
    for (const row of mediaRows) {
      const variant =
        row.variants.preview ?? row.variants.master ?? row.variants.display;
      if (!variant?.objectKey) continue;
      const keys = keysByResource.get(row.resourceId) ?? {};
      if (row.role === "preview") keys.preview = variant.objectKey;
      if (row.role === "icon") keys.icon = variant.objectKey;
      keysByResource.set(row.resourceId, keys);
    }
    const mediaKeys = [...keysByResource.values()].flatMap((keys) =>
      [keys.preview, keys.icon].filter((key): key is string => Boolean(key)),
    );
    const signed =
      mediaKeys.length > 0
        ? await objectStorageService.createPresignedGetUrls(mediaKeys)
        : new Map();
    for (const [resourceId, keys] of keysByResource) {
      const current: { preview?: string; icon?: string } = {};
      if (keys.preview) current.preview = signed.get(keys.preview)?.url;
      if (keys.icon) current.icon = signed.get(keys.icon)?.url;
      mediaByResource.set(resourceId, current);
    }
  }

  return rows.map((row) => {
    const media = row.resourceId
      ? mediaByResource.get(row.resourceId)
      : undefined;
    const previewKey = previewKeysByAsset.get(row.assetId);
    const previewUrl = previewKey
      ? signedImages.get(previewKey)?.url
      : undefined;
    return toTarget(row, media, previewUrl);
  });
}

function toTarget(
  row: MentionRow,
  media?: { preview?: string; icon?: string },
  imagePreviewUrl?: string,
): MentionTarget {
  const folderName = row.pathFolderNames?.at(-1);
  return {
    assetId: row.assetId,
    assetType: row.assetType as MentionType,
    label: mentionLabel(row),
    title: row.title,
    hex: row.hex,
    gradient: row.gradient,
    hostname: row.hostname,
    url: row.url,
    previewUrl: imagePreviewUrl ?? media?.preview ?? null,
    faviconUrl: media?.icon ?? null,
    isVideo:
      row.assetType === "video" ||
      (row.assetType === "link" &&
        ["youtube-oembed", "youtube-data-api"].includes(
          row.resolverKey ?? "",
        ) &&
        row.resourceKind === "video"),
    snippet: row.assetType === "note" ? noteSnippet(row.markdown ?? "") : null,
    locationLabel: folderName ?? row.collectionName ?? "Inbox",
    collectionSlug: row.collectionSlug,
    folderPath: row.pathFolderSlugs?.join("/") || null,
  };
}

function mentionLabel(row: MentionRow): string {
  if (row.title?.trim()) return row.title.trim();
  if (row.assetType === "image") {
    return (
      row.imageAlt?.trim() ||
      row.imageSourceLabel?.trim() ||
      "Untitled image"
    );
  }
  if (row.assetType === "video") {
    return row.videoSourceLabel?.trim() || "Untitled video";
  }
  if (row.gradient) {
    const type = row.gradient.type === "radial" ? "Radial" : "Linear";
    return `${type} Gradient`;
  }
  if (row.hex) return row.hex;
  if (row.hostname) return row.hostname;
  return "Untitled";
}

function noteSnippet(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, " ")
    .replace(/!?(?:\[([^\]]*)\])\([^)]*\)/g, "$1")
    .replace(/[#>*_~`|\]-]/g, " ")
    .replaceAll("[", " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
