import type { ImageAssetVariants } from "@/db/schema";
import type { BoardPosition, FolderChildPreview } from "@/dto/collection.dto";

export type ImageVariantLookup = Map<
  number,
  ImageAssetVariants & {
    original?: ImageAssetVariants["original"] & { url?: string };
    display?: ImageAssetVariants["display"] & { url?: string };
    preview?: ImageAssetVariants["preview"] & { url?: string };
    blurDataURL?: string | null;
  }
>;

export type FolderPreviewRow = {
  folderId: number | null;
  assetType: string | null;
  assetId: number | null;
  color: string | null;
  content: string | null;
  resourceId?: number | null;
  hostname?: string | null;
  title?: string | null;
};

/** Converts nullable persisted coordinates into the board's optional position. */
export function toBoardPosition(
  x: number | null,
  y: number | null,
): BoardPosition | null {
  return x === null || y === null ? null : { x, y };
}

/** Produces the compact visual preview displayed on folder cards. */
export function toFolderPreview(
  row: FolderPreviewRow,
  imageVariants: ImageVariantLookup,
): FolderChildPreview {
  const variants = row.assetId ? imageVariants.get(row.assetId) : undefined;
  const previewUrl = variants?.preview?.url ?? variants?.original?.url;
  if (row.assetType === "image" && previewUrl) {
    return {
      assetId: `image-${row.assetId}`,
      type: "image",
      url: previewUrl,
      blurDataURL: variants?.blurDataURL,
    };
  }

  if (row.assetType === "link" && row.hostname) {
    return {
      assetId: `link-${row.assetId}`,
      type: "link",
      hostname: row.hostname,
      title: row.title ?? null,
    };
  }

  return {
    assetId: `note-${row.assetId}`,
    type: "note",
    color: row.color ?? undefined,
    snippet: row.content ? makeSnippet(row.content) : undefined,
  };
}

/** Keeps the first rows in query order, up to the fixed preview limit per folder. */
export function firstPreviewRowsByParent<T>(
  rows: T[],
  getParentId: (row: T) => number | null,
  limit = 4,
): T[] {
  const counts = new Map<number, number>();
  const selected: T[] = [];

  for (const row of rows) {
    const parentId = getParentId(row);
    if (parentId === null) continue;

    const count = counts.get(parentId) ?? 0;
    if (count >= limit) continue;

    counts.set(parentId, count + 1);
    selected.push(row);
  }

  return selected;
}

/** Bounds Markdown for card previews while preserving its block structure. */
export function makeSnippet(content: string, maxLength = 1000): string {
  const normalized = content.replace(/\r\n?/g, "\n");
  if (normalized.length <= maxLength) return normalized;

  let snippet = normalized.slice(0, maxLength);
  const openFence = findOpenFence(snippet);
  if (openFence) {
    snippet += `${snippet.endsWith("\n") ? "" : "\n"}${openFence}`;
  }

  return `${snippet}\n\n…`;
}

function findOpenFence(content: string): string | undefined {
  let openFence: string | undefined;

  for (const line of content.split("\n")) {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (!match) continue;

    const fence = match[1]!;
    if (
      openFence &&
      fence[0] === openFence[0] &&
      fence.length >= openFence.length
    ) {
      openFence = undefined;
    } else if (!openFence) {
      openFence = fence;
    }
  }

  return openFence;
}
