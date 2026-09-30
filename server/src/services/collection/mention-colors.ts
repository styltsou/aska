import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { colorAssets, noteReferences } from "@/db/schema";
import type { MentionColors } from "@/dto/collection.dto";
import { mentionKey } from "@/lib/note-mentions";

/**
 * Color values for the assets referenced by the given notes, keyed by source
 * asset id. Resolves the whole page in one query so read-only mention pills
 * can draw swatches without a follow-up resolve request per card.
 *
 * Joins `color_assets` rather than `assets`, so a reference whose target was
 * deleted (or is a note) simply drops out instead of returning a null swatch.
 */
export async function fetchMentionColorsBySource(
  orgId: string,
  sourceAssetIds: ReadonlyArray<number | null | undefined>,
): Promise<Map<number, MentionColors>> {
  const ids = [
    ...new Set(sourceAssetIds.filter((id): id is number => id != null)),
  ];
  const result = new Map<number, MentionColors>();
  if (ids.length === 0) return result;

  const rows = await db
    .select({
      sourceAssetId: noteReferences.sourceAssetId,
      targetAssetId: noteReferences.targetAssetId,
      hex: colorAssets.hex,
      gradient: colorAssets.gradient,
    })
    .from(noteReferences)
    .innerJoin(
      colorAssets,
      eq(colorAssets.assetId, noteReferences.targetAssetId),
    )
    .where(
      and(
        eq(noteReferences.organizationId, orgId),
        inArray(noteReferences.sourceAssetId, ids),
      ),
    );

  for (const row of rows) {
    const existing = result.get(row.sourceAssetId) ?? {};
    existing[mentionKey("color", row.targetAssetId)] = {
      hex: row.hex,
      gradient: row.gradient ?? null,
    };
    result.set(row.sourceAssetId, existing);
  }

  return result;
}
