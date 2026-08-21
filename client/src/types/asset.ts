export interface ImageAsset {
  id: string;
  type: "image";
  url: string;
  /** Browser-only preview retained while the final image is decoded. */
  localPreviewUrl?: string;
  originalUrl?: string;
  originalWidth?: number;
  originalHeight?: number;
  contentType?: string;
  width: number;
  height: number;
  alt?: string;
  title?: string;
  sourceLabel?: string;
  sourceUrl?: string;
  isFavorite?: boolean;
  blurDataURL?: string;
  dominantColors?: string[];
  uploadStatus?: "uploading" | "processing";
  uploadProgress?: number;
  paletteStatus?: "processing" | "completed" | "failed";
  clientId?: string;
  sizeBytes?: number;
  createdAt?: string;
}

export interface NoteAsset {
  id: string;
  type: "note";
  content: string;
  color?: string;
  isFavorite?: boolean;
  wordCount?: number;
  readingTimeMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LinkAsset {
  id: string;
  type: "link";
  originalUrl: string;
  canonicalUrl?: string;
  hostname: string;
  title: string;
  description?: string;
  siteName?: string;
  resourceKind: string;
  resolutionStatus: "queued" | "resolving" | "partial" | "ready" | "failed";
  failureCategory?: string;
  resolvedAt?: string;
  staleAt?: string;
  previewImage?: {
    url: string;
    width: number;
    height: number;
    blurDataURL?: string;
    alt?: string;
  };
  favicon?: { url: string; width: number; height: number };
  clientId?: string;
  isFavorite?: boolean;
}

export interface ColorAsset {
  id: string;
  type: "color";
  hex: string;
  title?: string | null;
  isFavorite?: boolean;
  clientId?: string;
}

export interface FolderAssetPreview {
  assetId: string;
  type: "image" | "note" | "link" | "color";
  url?: string;
  blurDataURL?: string | null;
  color?: string;
  snippet?: string;
  hostname?: string;
  title?: string | null;
  hex?: string;
}

export interface FolderAsset {
  id: string;
  type: "folder";
  name: string;
  slug?: string;
  count?: number;
  previews?: FolderAssetPreview[];
  isFavorite?: boolean;
}

export type Asset =
  | ImageAsset
  | NoteAsset
  | LinkAsset
  | ColorAsset
  | FolderAsset;
