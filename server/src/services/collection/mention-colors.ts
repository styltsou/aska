import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  colorAssets,
  externalResourceMedia,
  externalResources,
  linkAssets,
  noteReferences,
} from "@/db/schema";
import type { MentionColors } from "@/dto/collection.dto";
import { mentionKey } from "@/lib/note-mentions";
import type { IObjectStorageService } from "@/services/object-storage.service";

/**
 * Visual values for referenced colors and links, keyed by source note ID. This
 * lets read-only mention pills render swatches and link thumbnails without a
 * follow-up resolve request per card.
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
      hex: colorAssets.hex,
      gradient: colorAssets.gradient,
      resourceId: linkAssets.resourceId,
      resourceKind: externalResources.resourceKind,
      resolverKey: externalResources.resolverKey,
    })
    .from(noteReferences)
    .leftJoin(
      colorAssets,
      eq(colorAssets.assetId, noteReferences.targetAssetId),
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
        inArray(noteReferences.targetType, ["color", "link"]),
      ),
    );

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
  const mediaKeys = [...keysByResource.values()].flatMap((keys) =>
    [keys.preview, keys.icon].filter((key): key is string => Boolean(key)),
  );
  const signedMedia =
    objectStorageService && mediaKeys.length > 0
      ? await objectStorageService.createPresignedGetUrls(mediaKeys)
      : new Map();

  for (const row of rows) {
    const existing = result.get(row.sourceAssetId) ?? {};
    if (row.targetType === "color") {
      existing[mentionKey("color", row.targetAssetId)] = {
        hex: row.hex,
        gradient: row.gradient ?? null,
      };
    } else if (row.targetType === "link") {
      const keys = row.resourceId
        ? keysByResource.get(row.resourceId)
        : undefined;
      existing[mentionKey("link", row.targetAssetId)] = {
        hex: null,
        gradient: null,
        previewUrl: keys?.preview
          ? (signedMedia.get(keys.preview)?.url ?? null)
          : null,
        faviconUrl: keys?.icon
          ? (signedMedia.get(keys.icon)?.url ?? null)
          : null,
        isVideo:
          ["youtube-oembed", "youtube-data-api"].includes(
            row.resolverKey ?? "",
          ) && row.resourceKind === "video",
      };
    }
    result.set(row.sourceAssetId, existing);
  }

  return result;
}
