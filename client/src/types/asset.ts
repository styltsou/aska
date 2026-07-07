export interface ImageAsset {
  id: string;
  type: "image";
  url: string;
  width: number;
  height: number;
  alt?: string;
  title?: string;
  sourceLabel?: string;
  sourceUrl?: string;
}

export interface NoteAsset {
  id: string;
  type: "note";
  content: string;
  color?: string;
}

export interface FolderAssetPreview {
  type: "image" | "note";
  url?: string;
  color?: string;
}

export interface FolderAsset {
  id: string;
  type: "folder";
  name: string;
  count?: number;
  previews?: FolderAssetPreview[];
}

export type Asset = ImageAsset | NoteAsset | FolderAsset;
