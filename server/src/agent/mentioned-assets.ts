import { and, eq, inArray } from "drizzle-orm";

import type { AgentReference } from "@/agent/note-agent";
import { db } from "@/db";
import {
  assets,
  colorAssets,
  externalResources,
  linkAssets,
  member,
  noteAssets,
  organization,
} from "@/db/schema";

/** Mentioned notes longer than this are cut; the agent reads them by parts. */
export const MENTIONED_NOTE_LIMIT = 200_000;

/** Asset types the agent can be given as context. */
export const MENTIONABLE_TYPES = ["note", "link", "color"] as const;
export type MentionableType = (typeof MENTIONABLE_TYPES)[number];
export type Mention = { assetId: number; type: MentionableType };

type Gradient = {
  from: string;
  to: string;
  angle: number;
  type?: "linear" | "radial";
  stops?: Array<{ color: string; position: number }>;
};

export type MentionRow = {
  id: number;
  type: string;
  title: string | null;
  noteMarkdown: string | null;
  linkUrl: string | null;
  linkNote: string | null;
  resourceTitle: string | null;
  resourceUrl: string | null;
  hostname: string | null;
  siteName: string | null;
  description: string | null;
  resourceKind: string | null;
  colorHex: string | null;
  colorGradient: Gradient | null;
  colorNote: string | null;
};

const lines = (entries: Array<[string, string | null | undefined]>) =>
  entries
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}: ${value!.trim()}`)
    .join("\n");

function describeGradient(gradient: Gradient) {
  const stops = gradient.stops?.length
    ? gradient.stops
        .map((stop) => `${stop.color} at ${Math.round(stop.position)}%`)
        .join(", ")
    : `${gradient.from} to ${gradient.to}`;
  return gradient.type === "radial"
    ? `radial, ${stops}`
    : `linear at ${gradient.angle}°, ${stops}`;
}

/**
 * Turns a loaded asset into the text the agent reads. Notes are their
 * Markdown; links and colors are short labeled summaries of what is stored
 * (a link's page text is not stored, only its details).
 */
export function referenceFromRow(row: MentionRow): AgentReference | null {
  if (row.type === "note" && row.noteMarkdown !== null) {
    return {
      kind: "note",
      title: row.title || "Untitled",
      text: row.noteMarkdown.slice(0, MENTIONED_NOTE_LIMIT),
    };
  }
  if (row.type === "link" && row.linkUrl) {
    const title = row.title || row.resourceTitle || row.hostname || "Link";
    return {
      kind: "link",
      title,
      text: lines([
        ["Title", title],
        ["URL", row.resourceUrl || row.linkUrl],
        ["Site", row.siteName || row.hostname],
        ["Kind", row.resourceKind],
        ["Description", row.description],
        ["User's note", row.linkNote],
      ]),
    };
  }
  if (row.type === "color" && (row.colorHex || row.colorGradient)) {
    const title = row.title || row.colorHex || "Color";
    return {
      kind: "color",
      title,
      text: lines([
        ["Name", title],
        ["Value", row.colorHex],
        ["Gradient", row.colorGradient && describeGradient(row.colorGradient)],
        ["User's note", row.colorNote],
      ]),
    };
  }
  return null;
}

/**
 * Loads the items the user @-mentioned from the workspace named in the
 * request. The same query checks that the user is a member of that workspace,
 * so an item is returned only if the user could open it. Items that are
 * missing, inaccessible or of another type are left out; the rest keep the
 * mention order.
 */
export async function loadMentions(
  workspaceSlug: string,
  userId: string,
  mentions: Mention[],
): Promise<AgentReference[]> {
  const ids = [...new Set(mentions.map((mention) => mention.assetId))];
  if (!ids.length) return [];
  const rows: MentionRow[] = await db
    .select({
      id: assets.id,
      type: assets.type,
      title: assets.title,
      noteMarkdown: noteAssets.markdown,
      linkUrl: linkAssets.originalUrl,
      linkNote: linkAssets.note,
      resourceTitle: externalResources.title,
      resourceUrl: externalResources.canonicalUrl,
      hostname: externalResources.hostname,
      siteName: externalResources.siteName,
      description: externalResources.description,
      resourceKind: externalResources.resourceKind,
      colorHex: colorAssets.hex,
      colorGradient: colorAssets.gradient,
      colorNote: colorAssets.note,
    })
    .from(assets)
    .innerJoin(organization, eq(organization.id, assets.organizationId))
    .innerJoin(member, eq(member.organizationId, organization.id))
    .leftJoin(noteAssets, eq(noteAssets.assetId, assets.id))
    .leftJoin(linkAssets, eq(linkAssets.assetId, assets.id))
    .leftJoin(
      externalResources,
      eq(externalResources.id, linkAssets.resourceId),
    )
    .leftJoin(colorAssets, eq(colorAssets.assetId, assets.id))
    .where(
      and(
        eq(organization.slug, workspaceSlug),
        eq(member.userId, userId),
        inArray(assets.type, [...MENTIONABLE_TYPES]),
        inArray(assets.id, ids),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return mentions.flatMap(({ assetId, type }, index) => {
    // Skip repeats, and a type that doesn't match what was mentioned.
    if (mentions.findIndex((m) => m.assetId === assetId) !== index) return [];
    const row = byId.get(assetId);
    if (!row || row.type !== type) return [];
    const reference = referenceFromRow(row);
    return reference ? [reference] : [];
  });
}
