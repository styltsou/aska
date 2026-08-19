import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { externalResourceMedia, type ResourceMediaVariants } from "@/db/schema";
import type { CollectionLinkNode } from "@/dto/collection.dto";
import type { IObjectStorageService } from "@/services/object-storage.service";

export type LinkProjectionRow = {
  assetId: number;
  originalUrl: string;
  resourceId: number;
  hostname: string;
  canonicalUrl: string | null;
  resourceTitle: string | null;
  description: string | null;
  siteName: string | null;
  resourceKind: string;
  resolutionStatus: CollectionLinkNode["resolutionStatus"];
  failureCategory: string | null;
  resolvedAt: Date | null;
  staleAt: Date | null;
  createdAt: Date;
};

type ProjectedMedia = {
  previewImage: CollectionLinkNode["previewImage"];
  favicon: CollectionLinkNode["favicon"];
};

export async function getResourceMediaLookup(
  resourceIds: number[],
  objectStorageService: IObjectStorageService,
): Promise<Map<number, ProjectedMedia>> {
  if (resourceIds.length === 0) return new Map();
  const rows = await db
    .select({
      resourceId: externalResourceMedia.resourceId,
      role: externalResourceMedia.role,
      status: externalResourceMedia.status,
      variants: externalResourceMedia.variants,
      blurDataURL: externalResourceMedia.blurDataURL,
      alt: externalResourceMedia.alt,
    })
    .from(externalResourceMedia)
    .where(
      and(
        inArray(externalResourceMedia.resourceId, [...new Set(resourceIds)]),
        eq(externalResourceMedia.status, "ready"),
      ),
    );

  const keys = rows.flatMap((row) =>
    Object.values(row.variants)
      .map((variant) => variant?.objectKey)
      .filter((key): key is string => Boolean(key)),
  );
  const signed = await objectStorageService.createPresignedGetUrls(keys);
  const lookup = new Map<number, ProjectedMedia>();

  for (const row of rows) {
    const current = lookup.get(row.resourceId) ?? {
      previewImage: null,
      favicon: null,
    };
    const rendition = preferredRendition(row.variants, row.role === "icon");
    if (!rendition) continue;
    const url = signed.get(rendition.objectKey)?.url;
    if (!url) continue;

    if (row.role === "preview") {
      current.previewImage = {
        url,
        width: rendition.width,
        height: rendition.height,
        blurDataURL: row.blurDataURL,
        alt: row.alt,
      };
    } else if (row.role === "icon") {
      current.favicon = {
        url,
        width: rendition.width,
        height: rendition.height,
      };
    }
    lookup.set(row.resourceId, current);
  }

  return lookup;
}

export function projectLinkNode(
  row: LinkProjectionRow,
  media: ProjectedMedia | undefined,
  position: CollectionLinkNode["position"],
): CollectionLinkNode {
  return {
    id: `link-${row.assetId}`,
    type: "link",
    originalUrl: row.originalUrl,
    canonicalUrl: row.canonicalUrl,
    hostname: row.hostname,
    title: row.resourceTitle?.trim() || row.hostname,
    description: row.description,
    siteName: row.siteName,
    resourceKind: row.resourceKind,
    resolutionStatus: row.resolutionStatus,
    failureCategory: row.failureCategory,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    staleAt: row.staleAt?.toISOString() ?? null,
    previewImage: media?.previewImage ?? null,
    favicon: media?.favicon ?? null,
    createdAt: row.createdAt.toISOString(),
    position,
  };
}

function preferredRendition(variants: ResourceMediaVariants, icon: boolean) {
  return icon
    ? (variants.preview ?? variants.master ?? variants.display)
    : (variants.display ?? variants.preview ?? variants.master);
}
