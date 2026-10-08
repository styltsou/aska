import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  assets,
  colorAssets,
  externalResourceMedia,
  externalResources,
  imageAssets,
  videoAssets,
  linkAssets,
  noteReferences,
} from "@/db/schema";
import type { MentionColors } from "@/dto/collection.dto";
import { mentionKey } from "@/lib/note-mentions";
import { getColorGradientTitle } from "@/lib/color-gradient";
import type { StoredColorGradient } from "@/lib/color-gradient";
import type { IObjectStorageService } from "@/services/object-storage.service";

/**
 * Presentation values for referenced colors, images, and links, keyed by
 * source note ID. Read-only mention pills can render current labels, swatches,
 * and media thumbnails without a follow-up resolve request per card.
 */
export async function fetchMentionColorsBySource(
  orgId: string,
  sourceAssetIds: ReadonlyArray<number | null | undefined>,
  objectStorageService?: IObjectStorageService,
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
      targetType: noteReferences.targetType,
      assetTitle: assets.title,
      imageVariants: imageAssets.variants,
      imageAlt: imageAssets.alt,
      videoPoster: videoAssets.poster,
      videoSourceLabel: videoAssets.sourceLabel,
      hex: colorAssets.hex,
      gradient: colorAssets.gradient,
      resourceId: linkAssets.resourceId,
      hostname: externalResources.hostname,
      resourceKind: externalResources.resourceKind,
      resolverKey: externalResources.resolverKey,
    })
    .from(noteReferences)
    .leftJoin(
      assets,
      and(
        eq(assets.id, noteReferences.targetAssetId),
        eq(assets.organizationId, noteReferences.organizationId),
      ),
    )
    .leftJoin(
      colorAssets,
      eq(colorAssets.assetId, noteReferences.targetAssetId),
    )
    .leftJoin(
      imageAssets,
      eq(imageAssets.assetId, noteReferences.targetAssetId),
    )
    .leftJoin(
      videoAssets,
      eq(videoAssets.assetId, noteReferences.targetAssetId),
    )
    .leftJoin(
      linkAssets,
      and(
        eq(linkAssets.assetId, noteReferences.targetAssetId),
        eq(linkAssets.organizationId, noteReferences.organizationId),
      ),
    )
    .leftJoin(
      externalResources,
      and(
        eq(externalResources.id, linkAssets.resourceId),
        eq(externalResources.organizationId, noteReferences.organizationId),
      ),
    )
    .where(
      and(
        eq(noteReferences.organizationId, orgId),
        inArray(noteReferences.sourceAssetId, ids),
        inArray(noteReferences.targetType, ["color", "link", "image", "video"]),
      ),
    );

  const imageKeysByAsset = new Map<number, string>();
  const videoKeysByAsset = new Map<number, string>();
  for (const row of rows) {
    if (row.targetType === "image") {
      const key =
        row.imageVariants?.preview?.objectKey ??
        row.imageVariants?.display?.objectKey;
      if (key) imageKeysByAsset.set(row.targetAssetId, key);
    } else if (row.targetType === "video") {
      const key =
        row.videoPoster?.preview?.objectKey ??
        row.videoPoster?.display?.objectKey;
      if (key) videoKeysByAsset.set(row.targetAssetId, key);
    }
  }
  const resourceIds = [
    ...new Set(rows.flatMap((row) => (row.resourceId ? [row.resourceId] : []))),
  ];
  const mediaRows =
    objectStorageService && resourceIds.length > 0
      ? await db
          .select({
            resourceId: externalResourceMedia.resourceId,
            role: externalResourceMedia.role,
            variants: externalResourceMedia.variants,
          })
          .from(externalResourceMedia)
          .where(
            and(
              eq(externalResourceMedia.organizationId, orgId),
              inArray(externalResourceMedia.resourceId, resourceIds),
              inArray(externalResourceMedia.role, ["preview", "icon"]),
              eq(externalResourceMedia.status, "ready"),
            ),
          )
      : [];
  const keysByResource = new Map<number, { preview?: string; icon?: string }>();
  for (const row of mediaRows) {
    const variant =
      row.variants.preview ?? row.variants.master ?? row.variants.display;
    if (!variant?.objectKey) continue;
    const keys = keysByResource.get(row.resourceId) ?? {};
    if (row.role === "preview") keys.preview = variant.objectKey;
    if (row.role === "icon") keys.icon = variant.objectKey;
    keysByResource.set(row.resourceId, keys);
  }
  const mediaKeys = [
    ...new Set([
      ...[...keysByResource.values()].flatMap((keys) =>
        [keys.preview, keys.icon].filter((key): key is string => Boolean(key)),
      ),
      ...imageKeysByAsset.values(),
      ...videoKeysByAsset.values(),
    ]),
  ];
  const signedMedia =
    objectStorageService && mediaKeys.length > 0
      ? await objectStorageService.createPresignedGetUrls(mediaKeys)
      : new Map();

  for (const row of rows) {
    const existing = result.get(row.sourceAssetId) ?? {};
    if (row.targetType === "color") {
      existing[mentionKey("color", row.targetAssetId)] = {
        label: mentionLabel(row),
        ...(row.gradient
          ? { gradient: row.gradient }
          : row.hex
            ? { hex: row.hex }
            : {}),
      };
    } else if (row.targetType === "link") {
      const keys = row.resourceId
        ? keysByResource.get(row.resourceId)
        : undefined;
      const previewUrl = keys?.preview
        ? signedMedia.get(keys.preview)?.url
        : undefined;
      const faviconUrl = keys?.icon
        ? signedMedia.get(keys.icon)?.url
        : undefined;
      const isVideo =
        ["youtube-oembed", "youtube-data-api"].includes(
          row.resolverKey ?? "",
        ) && row.resourceKind === "video";
      existing[mentionKey("link", row.targetAssetId)] = {
        label: mentionLabel(row),
        ...(previewUrl ? { previewUrl } : {}),
        ...(faviconUrl ? { faviconUrl } : {}),
        ...(isVideo ? { isVideo } : {}),
      };
    } else if (row.targetType === "image") {
      const imageKey = imageKeysByAsset.get(row.targetAssetId);
      const previewUrl = imageKey ? signedMedia.get(imageKey)?.url : undefined;
      existing[mentionKey("image", row.targetAssetId)] = {
        label: mentionLabel(row),
        ...(previewUrl ? { previewUrl } : {}),
      };
    } else if (row.targetType === "video") {
      const videoKey = videoKeysByAsset.get(row.targetAssetId);
      const previewUrl = videoKey ? signedMedia.get(videoKey)?.url : undefined;
      existing[mentionKey("video", row.targetAssetId)] = {
        label: mentionLabel(row),
        ...(previewUrl ? { previewUrl } : {}),
      };
    }
    result.set(row.sourceAssetId, existing);
  }

  return result;
}

function mentionLabel(row: {
  assetTitle: string | null;
  targetType: string;
  imageAlt: string | null;
  videoSourceLabel: string | null;
  gradient: StoredColorGradient | null;
  hex: string | null;
  hostname: string | null;
}) {
  if (row.assetTitle?.trim()) return row.assetTitle.trim();
  if (row.targetType === "image") {
    return row.imageAlt?.trim() || "Untitled image";
  }
  if (row.targetType === "video") {
    return row.videoSourceLabel?.trim() || "Untitled video";
  }
  if (row.targetType === "color") {
    if (row.gradient) return getColorGradientTitle(row.gradient);
    if (row.hex) return row.hex;
  }
  return row.hostname || "Untitled";
}
