export interface ImageAsset {
  id: string;
  type: "image";
  url: string;
  originalUrl?: string;
  originalWidth?: number;
  originalHeight?: number;
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
}

export interface FolderAssetPreview {
  assetId: string;
  type: "image" | "note";
  url?: string;
  blurDataURL?: string | null;
  color?: string;
  snippet?: string;
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

export type Asset = ImageAsset | NoteAsset | FolderAsset;
