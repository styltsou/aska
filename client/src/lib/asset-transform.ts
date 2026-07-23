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
      width: node.width,
      height: node.height,
      title: node.title ?? undefined,
      alt: node.alt ?? undefined,
      sourceLabel: node.sourceLabel ?? undefined,
      sourceUrl: node.sourceUrl ?? undefined,
      isFavorite: node.isFavorite,
      blurDataURL: node.blurDataURL ?? undefined,
      dominantColors: node.dominantColors,
      uploadStatus: node.uploadStatus,
      uploadProgress: node.uploadProgress,
      clientId: node.clientId,
      sizeBytes: node.sizeBytes,
      createdAt: node.createdAt,
    };
  }

  return {
    id: node.id,
    type: "note",
    content: node.content,
    color: node.color ?? undefined,
    isFavorite: node.isFavorite,
    wordCount: node.wordCount,
    readingTimeMinutes: node.readingTimeMinutes,
  };
}
