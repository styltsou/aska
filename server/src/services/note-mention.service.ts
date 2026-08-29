import {
  and,
  asc,
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
  noteAssets,
  noteReferences,
} from "@/db/schema";
import type {
  MentionResolveInput,
  MentionSearchQuery,
  MentionTarget,
  MentionTargetsResponse,
  MentionType,
} from "@/dto/note-mention.dto";
import {
  escapeMentionLabel,
  extractNoteMentions,
  mentionKey,
  rewriteNoteMentionLabels,
} from "@/lib/note-mentions";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | DatabaseTransaction;

type MentionRow = {
  assetId: number;
  assetType: "image" | "note" | "link" | "color";
  title: string | null;
  updatedAt: Date;
  noteColor: string | null;
  markdown: string | null;
  hex: string | null;
  gradient: typeof colorAssets.$inferSelect.gradient | null;
  collectionName: string | null;
  collectionSlug: string | null;
  pathFolderNames: string[] | null;
  pathFolderSlugs: string[] | null;
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
}

export class NoteMentionService implements INoteMentionService {
  async search(
    orgId: string,
    query: MentionSearchQuery,
  ): Promise<MentionTargetsResponse> {
    const types = [...new Set(query.types ?? (["note", "color"] as const))];
    const normalizedQuery = query.q.trim();

    if (!normalizedQuery && types.length === 2) {
      const [notes, colors] = await Promise.all([
        findMentionRows(orgId, ["note"], "", query.limit, query.sourceAssetId),
        findMentionRows(orgId, ["color"], "", query.limit, query.sourceAssetId),
      ]);
      return {
        targets: balanceRecentTargets(notes, colors, query.limit).map(toTarget),
      };
    }

    const rows = await findMentionRows(
      orgId,
      [...types],
      normalizedQuery,
      query.limit,
      query.sourceAssetId,
    );
    return { targets: rows.map(toTarget) };
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

    return {
      targets: rows
        .filter(
          (row) =>
            (row.assetType === "note" || row.assetType === "color") &&
            requestedKeys.has(
              mentionKey(row.assetType as MentionType, row.assetId),
            ),
        )
        .map(toTarget),
    };
  }
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
      (row.assetType === "note" || row.assetType === "color") &&
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
      noteColor: noteAssets.color,
      markdown: noteAssets.markdown,
      hex: colorAssets.hex,
      gradient: colorAssets.gradient,
      collectionName: collectionsTable.name,
      collectionSlug: collectionsTable.slug,
      pathFolderNames: collectionNodes.pathFolderNames,
      pathFolderSlugs: collectionNodes.pathFolderSlugs,
    })
    .from(assets)
    .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
    .leftJoin(colorAssets, eq(colorAssets.assetId, assets.id))
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
        or(eq(assets.type, "color"), isNotNull(assets.title)),
        query
          ? or(
              ilike(assets.title, match),
              and(
                eq(assets.type, "color"),
                or(
                  ilike(colorAssets.hex, match),
                  sql`lower(coalesce(${colorAssets.gradient}->>'type', '') || ' gradient') like lower(${match})`,
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
  notes: MentionRow[],
  colors: MentionRow[],
  limit: number,
): MentionRow[] {
  const selected = [...notes.slice(0, 2), ...colors.slice(0, 2)];
  const selectedIds = new Set(selected.map((row) => row.assetId));
  const remaining = [...notes, ...colors]
    .filter((row) => !selectedIds.has(row.assetId))
    .sort(
      (left, right) =>
        right.updatedAt.getTime() - left.updatedAt.getTime() ||
        left.assetId - right.assetId,
    );
  return [...selected, ...remaining].slice(0, limit);
}

function toTarget(row: MentionRow): MentionTarget {
  const folderName = row.pathFolderNames?.at(-1);
  return {
    assetId: row.assetId,
    assetType: row.assetType as MentionType,
    label: mentionLabel(row),
    title: row.title,
    noteColor: row.noteColor,
    hex: row.hex,
    gradient: row.gradient,
    snippet: row.assetType === "note" ? noteSnippet(row.markdown ?? "") : null,
    locationLabel: folderName ?? row.collectionName ?? "Inbox",
    collectionSlug: row.collectionSlug,
    folderPath: row.pathFolderSlugs?.join("/") || null,
  };
}

function mentionLabel(row: MentionRow): string {
  if (row.title?.trim()) return row.title.trim();
  if (row.hex) return row.hex;
  if (row.gradient) {
    const type = row.gradient.type === "radial" ? "Radial" : "Linear";
    return `${type} Gradient`;
  }
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
