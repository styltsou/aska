import { and, eq, inArray } from "drizzle-orm";

import type { AgentReference } from "@/agent/note-agent";
import { db } from "@/db";
import {
  assets,
  colorAssets,
  externalResources,
  imageAssets,
  linkAssets,
  member,
  noteAssets,
  organization,
  type ImageAssetVariants,
  type StoredImageObjectVariant,
} from "@/db/schema";

/** Mentioned notes longer than this are cut; the agent reads them by parts. */
export const MENTIONED_NOTE_LIMIT = 200_000;

/** Asset types the agent can be given as context. */
export const MENTIONABLE_TYPES = ["note", "link", "color", "image"] as const;
export type MentionableType = (typeof MENTIONABLE_TYPES)[number];
export type Mention = { assetId: number; type: MentionableType };

/** Images the model sees per request; the rest are described as text only. */
export const MAX_ATTACHED_IMAGES = 2;
/** Larger stored variants are described, not attached. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Formats the model accepts as image input. */
const MODEL_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

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
  imageWidth: number | null;
  imageHeight: number | null;
  imageAlt: string | null;
  imageNote: string | null;
  imageSourceLabel: string | null;
  imageSourceUrl: string | null;
  imageColors: string[] | null;
  imageVariants: ImageAssetVariants | null;
};

/** Reads a stored object's bytes, e.g. from S3. */
export type FetchObject = (key: string) => Promise<Uint8Array>;

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
 * Markdown; links, colors and images are short labeled summaries of what is
 * stored (a link's page text is not stored, only its details). An image's
 * pixels are attached separately, see `attachImages`.
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
  if (row.type === "image" && row.imageWidth && row.imageHeight) {
    const title = row.title || row.imageAlt || "Image";
    return {
      kind: "image",
      title,
      text: lines([
        ["Title", title],
        ["Alt text", row.imageAlt],
        ["Size", `${row.imageWidth}×${row.imageHeight}`],
        ["Source", row.imageSourceLabel || row.imageSourceUrl],
        ["Dominant colors", row.imageColors?.join(", ")],
        ["User's note", row.imageNote],
      ]),
    };
  }
  return null;
}

/**
 * The stored variant to show the model: the display size (about 960px wide)
 * when there is one, else the smaller preview, else the original. Null when
 * none is in a format the model reads or within the size limit.
 */
export function imageVariantForModel(
  variants: ImageAssetVariants | null,
): StoredImageObjectVariant | null {
  for (const variant of [
    variants?.display,
    variants?.preview,
    variants?.original,
  ]) {
    if (
      variant &&
      MODEL_IMAGE_TYPES.has(variant.contentType) &&
      variant.sizeBytes <= MAX_IMAGE_BYTES
    ) {
      return variant;
    }
  }
  return null;
}

/**
 * Attaches the pixels of up to MAX_ATTACHED_IMAGES mentioned images. An image
 * that can't be fetched stays a text description, so a storage hiccup never
 * fails the request.
 */
export async function attachImages(
  mentioned: Array<{ reference: AgentReference; row: MentionRow }>,
  fetchObject: FetchObject,
): Promise<AgentReference[]> {
  let budget = MAX_ATTACHED_IMAGES;
  const pending = mentioned.map(async ({ reference, row }) => {
    if (reference.kind !== "image" || budget <= 0) return reference;
    const variant = imageVariantForModel(row.imageVariants);
    if (!variant) return reference;
    budget -= 1;
    try {
      const bytes = await fetchObject(variant.objectKey);
      return {
        ...reference,
        image: {
          mimeType: variant.contentType,
          data: Buffer.from(bytes).toString("base64"),
        },
      };
    } catch (error) {
      console.warn("Attaching a mentioned image failed", error);
      return reference;
    }
  });
  return Promise.all(pending);
}

/**
 * Loads the items the user @-mentioned from the workspace named in the
 * request. The same query checks that the user is a member of that workspace,
 * so an item is returned only if the user could open it. Items that are
 * missing, inaccessible or of another type are left out; the rest keep the
 * mention order. With `fetchObject`, mentioned images also carry their
 * pixels.
 */
export async function loadMentions(
  workspaceSlug: string,
  userId: string,
  mentions: Mention[],
  { fetchObject }: { fetchObject?: FetchObject | undefined } = {},
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
      imageWidth: imageAssets.width,
      imageHeight: imageAssets.height,
      imageAlt: imageAssets.alt,
      imageNote: imageAssets.note,
      imageSourceLabel: imageAssets.sourceLabel,
      imageSourceUrl: imageAssets.sourceUrl,
      imageColors: imageAssets.dominantColors,
      imageVariants: imageAssets.variants,
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
    .leftJoin(imageAssets, eq(imageAssets.assetId, assets.id))
    .where(
      and(
        eq(organization.slug, workspaceSlug),
        eq(member.userId, userId),
        inArray(assets.type, [...MENTIONABLE_TYPES]),
        inArray(assets.id, ids),
      ),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const mentioned = mentions.flatMap(({ assetId, type }, index) => {
    // Skip repeats, and a type that doesn't match what was mentioned.
    if (mentions.findIndex((m) => m.assetId === assetId) !== index) return [];
    const row = byId.get(assetId);
    if (!row || row.type !== type) return [];
    const reference = referenceFromRow(row);
    return reference ? [{ reference, row }] : [];
  });
  return fetchObject
    ? attachImages(mentioned, fetchObject)
    : mentioned.map(({ reference }) => reference);
}
