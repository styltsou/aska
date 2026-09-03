import type { CollectionNode } from "@/api/collection";
import type { Asset } from "@/types/asset";

export function collectionNodeToAsset(node: CollectionNode): Asset {
  if (node.type === "folder") {
    return {
      id: node.id,
      type: "folder",
      name: node.name,
      slug: node.slug,
      count: node.count,
      previews: node.previews,
    };
  }

  if (node.type === "image") {
    return {
      id: node.id,
      type: "image",
      url: node.url,
      localPreviewUrl: node.localPreviewUrl,
      originalUrl: node.originalUrl,
      originalWidth: node.originalWidth,
      originalHeight: node.originalHeight,
      contentType: node.contentType,
      width: node.width,
      height: node.height,
      title: node.title ?? undefined,
      alt: node.alt ?? undefined,
      note: node.note,
      sourceLabel: node.sourceLabel ?? undefined,
      sourceUrl: node.sourceUrl ?? undefined,
      isFavorite: node.isFavorite,
      blurDataURL: node.blurDataURL ?? undefined,
      dominantColors: node.dominantColors,
      paletteStatus: node.paletteStatus,
      uploadStatus: node.uploadStatus,
      uploadProgress: node.uploadProgress,
      clientId: node.clientId,
      sizeBytes: node.sizeBytes,
      createdAt: node.createdAt,
    };
  }

  if (node.type === "link") {
    return {
      id: node.id,
      type: "link",
      originalUrl: node.originalUrl,
      canonicalUrl: node.canonicalUrl ?? undefined,
      hostname: node.hostname,
      title: node.title,
      description: node.description ?? undefined,
      note: node.note,
      siteName: node.siteName ?? undefined,
      resourceKind: node.resourceKind,
      resolutionStatus: node.resolutionStatus,
      failureCategory: node.failureCategory ?? undefined,
      resolvedAt: node.resolvedAt ?? undefined,
      staleAt: node.staleAt ?? undefined,
      previewImage: node.previewImage
        ? {
            ...node.previewImage,
            blurDataURL: node.previewImage.blurDataURL ?? undefined,
            alt: node.previewImage.alt ?? undefined,
          }
        : undefined,
      favicon: node.favicon ?? undefined,
      video: node.video ?? undefined,
      clientId: node.clientId,
    };
  }

  if (node.type === "color") {
    return {
      id: node.id,
      type: "color",
      hex: node.hex,
      gradient: node.gradient,
      title: node.title,
      isFavorite: node.isFavorite,
      clientId: node.clientId,
    };
  }

  return {
    id: node.id,
    type: "note",
    content: node.content,
    title: node.title,
    isFavorite: node.isFavorite,
    isExpanded: node.isExpanded,
    wordCount: node.wordCount,
    readingTimeMinutes: node.readingTimeMinutes,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  };
}
