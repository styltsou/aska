export type FolderChildPreview = {
  assetId: string;
  type: "image" | "note";
  url?: string;
  blurDataURL?: string | null;
  color?: string;
  snippet?: string;
};

export type DetailedCollection = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  previews: FolderChildPreview[];
};

export type CollectionsData = {
  collections: DetailedCollection[];
};

export type CreateCollectionInput = {
  name: string;
};

export type CreatedCollection = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCollectionResponse = {
  collection: CreatedCollection;
};

export type CreateFolderInput = {
  name: string;
  parentFolderPath?: string;
};

export type CollectionFolderNode = {
  id: string;
  type: "folder";
  name: string;
  slug: string;
  count: number;
  previews: FolderChildPreview[];
};

export type CreatedFolder = {
  id: number;
  name: string;
  slug: string;
  path: string;
  count: number;
  previews: FolderChildPreview[];
};

export type CreateFolderResponse = {
  folder: CreatedFolder;
};

export type CreateNoteInput = {
  content: string;
  color?: string;
  parentFolderPath?: string;
};

export type CollectionImageNode = {
  id: string;
  type: "image";
  url: string;
  originalUrl?: string;
  originalWidth?: number;
  originalHeight?: number;
  width: number;
  height: number;
  title: string | null;
  alt: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  isFavorite: boolean;
  blurDataURL?: string | null;
  dominantColors?: string[];
  uploadStatus?: "uploading" | "processing";
  uploadProgress?: number;
  clientId?: string;
  sizeBytes?: number;
  createdAt: string;
};

export type CollectionNoteNode = {
  id: string;
  type: "note";
  content: string;
  color: string | null;
  isFavorite: boolean;
  wordCount: number;
  readingTimeMinutes: number;
};

export type CreateNoteResponse = {
  note: CollectionNoteNode;
};

export type CreateImageUploadInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  title?: string;
  alt?: string;
  parentFolderPath?: string;
};

export type CreateImageUploadResponse = {
  upload: {
    id: number;
    objectKey: string;
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
    maxSizeBytes: number;
  };
};

export type ImageUploadStatus = {
  id: number;
  status: "pending" | "uploaded" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  image?: CollectionImageNode;
};

export type CreateRemoteImageInput = {
  url: string;
  title?: string;
  alt?: string;
  parentFolderPath?: string;
};

export type CreateRemoteImageResponse = {
  upload: ImageUploadStatus;
};

export type ImageUploadStatusResponse = {
  upload: ImageUploadStatus;
};

export type PlaceAssetInput = {
  collectionSlug: string;
  parentFolderPath?: string;
};

export type PlaceAssetResponse = {
  node: CollectionNode;
};

export type DeleteAssetResponse = {
  deletedAssetId: string;
};

export type DeleteCollectionNodeResponse = {
  deletedNodeId: string;
  deletedAssetCount: number;
};

export type CollectionNode =
  | CollectionFolderNode
  | CollectionImageNode
  | CollectionNoteNode;

export type Breadcrumb = {
  id: number;
  name: string;
  slug: string;
};

export type CollectionContentsResponse = {
  collection: {
    id: number;
    name: string;
    slug: string;
  };
  breadcrumbs: Breadcrumb[];
  nodes: CollectionNode[];
};

export type InboxContentsResponse = CollectionContentsResponse;
