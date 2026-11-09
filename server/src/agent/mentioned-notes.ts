import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { assets, member, noteAssets, organization } from "@/db/schema";

/** Mentioned notes longer than this are cut; the agent reads them by parts. */
export const MENTIONED_NOTE_LIMIT = 200_000;

export type MentionedNote = { title: string; markdown: string };

/**
 * Loads the notes the user @-mentioned, by asset ID, from the workspace named
 * in the request. The same query checks that the user is a member of that
 * workspace, so a note is returned only if the user could open it. Notes that
 * are missing or not accessible are left out; the rest keep the mention order.
 */
export async function loadMentionedNotes(
  workspaceSlug: string,
  userId: string,
  assetIds: number[],
): Promise<MentionedNote[]> {
  const ids = [...new Set(assetIds)];
  if (!ids.length) return [];
  const rows = await db
    .select({
      id: assets.id,
      title: assets.title,
      markdown: noteAssets.markdown,
    })
    .from(assets)
    .innerJoin(noteAssets, eq(noteAssets.assetId, assets.id))
    .innerJoin(organization, eq(organization.id, assets.organizationId))
    .innerJoin(member, eq(member.organizationId, organization.id))
    .where(
      and(
        eq(organization.slug, workspaceSlug),
        eq(member.userId, userId),
        eq(assets.type, "note"),
        inArray(assets.id, ids),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row
      ? [
          {
            title: row.title || "Untitled",
            markdown: row.markdown.slice(0, MENTIONED_NOTE_LIMIT),
          },
        ]
      : [];
  });
}
