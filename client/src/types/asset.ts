import type { ColorGradient, MentionColors } from "@/api/collection/types";

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
  note?: string | null;
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
  updatedAt?: string;
}

export interface VideoAsset {
  id: string;
  type: "video";
  url: string | null;
  posterUrl?: string | null;
  storyboard?: {
    url: string;
    frameCount: number;
    columns: number;
    tileWidth: number;
    tileHeight: number;
    intervalSeconds: number;
  } | null;
  contentType: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  title?: string | null;
  note?: string | null;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  processingStatus: "processing" | "completed" | "failed";
  processingError?: string | null;
  isFavorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NoteAsset {
  id: string;
  type: "note";
  content: string;
  title?: string | null;
  isFavorite?: boolean;
  isExpanded?: boolean;
  wordCount?: number;
  readingTimeMinutes?: number;
  createdAt?: string;
  updatedAt?: string;
  mentionColors?: MentionColors;
}

export interface LinkAsset {
  id: string;
  type: "link";
  originalUrl: string;
  canonicalUrl?: string;
  hostname: string;
  title: string;
  description?: string;
  note?: string | null;
  siteName?: string;
  resourceKind: string;
  resolutionStatus: "queued" | "resolving" | "partial" | "ready" | "failed";
  failureCategory?: string;
  resolvedAt?: string;
  staleAt?: string;
  /** When the link was saved into the workspace, not when it joined a board. */
  createdAt?: string;
  /** Last time a person edited the note, absent when it was never edited. */
  updatedAt?: string;
  previewImage?: {
    url: string;
    width: number;
    height: number;
    blurDataURL?: string;
    alt?: string;
  };
  favicon?: { url: string; width: number; height: number };
  video?: {
    provider: "youtube";
    videoId: string;
    channelName: string | null;
    channelUrl: string | null;
    channelAvatarUrl?: string;
  };
  /** Browser-only metadata for a YouTube card before server resolution wins. */
  optimisticYouTube?: {
    videoId: string;
    channelName: string | null;
    metadataStatus: "loading" | "ready";
  };
  clientId?: string;
  isFavorite?: boolean;
}

export interface ColorAsset {
  id: string;
  type: "color";
  hex: string;
  note?: string | null;
  gradient?: {
    from: string;
    to: string;
    angle: number;
    type?: "linear" | "radial";
    stops?: Array<{ color: string; position: number }>;
  } | null;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isFavorite?: boolean;
  clientId?: string;
}

export interface FolderAssetPreview {
  assetId: string;
  type: "image" | "video" | "note" | "link" | "color";
  url?: string;
  width?: number;
  height?: number;
  blurDataURL?: string | null;
  snippet?: string;
  hostname?: string;
  siteName?: string | null;
  title?: string | null;
  hex?: string;
  gradient?: ColorGradient | null;
  favicon?: string;
  videoId?: string;
  channelName?: string | null;
  channelAvatarUrl?: string;
  description?: string | null;
  mentionColors?: MentionColors;
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
  | VideoAsset
  | NoteAsset
  | LinkAsset
  | ColorAsset
  | FolderAsset;
