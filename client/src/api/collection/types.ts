export type FolderChildPreview = {
  assetId: string;
  type: "image" | "note" | "link" | "color";
  url?: string;
  blurDataURL?: string | null;
  color?: string;
  snippet?: string;
  hostname?: string;
  title?: string | null;
  hex?: string;
};

export type BoardPosition = { x: number; y: number };
export type ContentTypeFilter = "image" | "note" | "link" | "color" | "folder";

export type BoardVisibleBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type BoardInsertionPlacement = {
  /**
   * A flow-space anchor observed by the browser. The placement resolver never
   * derives one from browser-local viewport state.
   */
  position?: BoardPosition;
  /**
   * Keeps an explicit pointer-based placement at its requested coordinate,
   * even when it overlaps an existing card. This is client-only metadata and
   * is resolved before the position is persisted.
   */
  collisionBehavior?: "preserve-anchor";
  batch?: {
    index: number;
    size: number;
    /** Complete image geometry for batches whose items are created one at a time. */
    imageDimensions?: readonly { width: number; height: number }[];
  };
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
  position?: BoardPosition;
};

export type CollectionFolderNode = {
  id: string;
  type: "folder";
  name: string;
  slug: string;
  count: number;
  folderCount: number;
  previews: FolderChildPreview[];
  createdAt: string;
  position: BoardPosition | null;
  /** Browser-only marker while a flatten mutation for this folder is in flight. */
  flattenStatus?: "pending";
};

export type CreatedFolder = {
  id: number;
  name: string;
  slug: string;
  path: string;
  count: number;
  previews: FolderChildPreview[];
  createdAt: string;
  position: BoardPosition | null;
};

export type CreateFolderResponse = {
  folder: CreatedFolder;
};

export type CreateNoteInput = {
  content: string;
  title?: string | null;
  color?: string;
  parentFolderPath?: string;
  position?: BoardPosition;
};

export type UpdateNoteInput = {
  content?: string;
  title?: string | null;
  color?: string | null;
  isExpanded?: boolean;
};

export type UpdatedNote = {
  id: string;
  type: "note";
  content: string;
  title?: string | null;
  color: string | null;
  isFavorite: boolean;
  isExpanded: boolean;
  wordCount: number;
  readingTimeMinutes: number;
  createdAt?: string;
  updatedAt: string;
};

export type UpdateNoteResponse = {
  note: UpdatedNote;
};

export type CollectionImageNode = {
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
  title: string | null;
  alt: string | null;
  note: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  isFavorite: boolean;
  blurDataURL?: string | null;
  dominantColors?: string[];
  variantStatus?: "processing" | "completed" | "failed";
  paletteStatus?: "processing" | "completed" | "failed";
  uploadStatus?: "uploading" | "processing";
  uploadProgress?: number;
  clientId?: string;
  sizeBytes?: number;
  createdAt: string;
  position: BoardPosition | null;
};

export type CollectionNoteNode = {
  id: string;
  type: "note";
  content: string;
  title?: string | null;
  color: string | null;
  isFavorite: boolean;
  isExpanded?: boolean;
  wordCount: number;
  readingTimeMinutes: number;
  createdAt: string;
  updatedAt?: string;
  clientId?: string;
  position: BoardPosition | null;
};

export type LinkResolutionStatus =
  | "queued"
  | "resolving"
  | "partial"
  | "ready"
  | "failed";

export type LinkVideo = {
  provider: "youtube";
  videoId: string;
  channelName: string | null;
  channelUrl: string | null;
};

export type CollectionLinkNode = {
  id: string;
  type: "link";
  originalUrl: string;
  canonicalUrl: string | null;
  hostname: string;
  title: string;
  description: string | null;
  note: string | null;
  siteName: string | null;
  resourceKind: string;
  resolutionStatus: LinkResolutionStatus;
  failureCategory: string | null;
  resolvedAt: string | null;
  staleAt: string | null;
  previewImage: {
    url: string;
    width: number;
    height: number;
    blurDataURL?: string | null;
    alt?: string | null;
  } | null;
  favicon: {
    url: string;
    width: number;
    height: number;
  } | null;
  video: LinkVideo | null;
  createdAt: string;
  clientId?: string;
  position: BoardPosition | null;
};

export type CreateLinkInput = {
  url: string;
  parentFolderPath?: string;
  position?: BoardPosition;
};

export type CreateLinkResponse = { link: CollectionLinkNode };

export type CreateNoteResponse = {
  note: CollectionNoteNode;
};

export type PeekableAssetResponse = {
  asset: CollectionNoteNode | CollectionColorNode;
};

export type CreateColorInput = {
  hex: string;
  gradient?: ColorGradient;
  parentFolderPath?: string;
  position?: BoardPosition;
};

export type CollectionColorNode = {
  id: string;
  type: "color";
  hex: string;
  gradient?: ColorGradient | null;
  title: string | null;
  isFavorite: boolean;
  createdAt: string;
  clientId?: string;
  position: BoardPosition | null;
};

export type CreateColorResponse = { color: CollectionColorNode };

export type UpdateColorInput = {
  hex: string;
  gradient?: ColorGradient | null;
};

export type UpdatedColor = Pick<
  CollectionColorNode,
  "id" | "type" | "hex" | "title" | "isFavorite" | "gradient"
>;

export type UpdateColorResponse = { color: UpdatedColor };

export type UpdateImageInput = {
  note: string | null;
};

export type UpdatedImage = {
  id: string;
  type: "image";
  note: string | null;
  isFavorite: boolean;
  updatedAt: string;
};

export type UpdateImageResponse = { image: UpdatedImage };

export type UpdateLinkInput = {
  note: string | null;
};

export type UpdatedLink = {
  id: string;
  type: "link";
  note: string | null;
  isFavorite: boolean;
  updatedAt: string;
};

export type UpdateLinkResponse = { link: UpdatedLink };

export type ColorGradient = {
  from: string;
  to: string;
  angle: number;
  type?: "linear" | "radial";
  stops?: Array<{ color: string; position: number }>;
};

export type CreateImageUploadInput = {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
  title?: string;
  alt?: string;
  parentFolderPath?: string;
  position?: BoardPosition;
};

export type CreateImageUploadResponse = {
  upload: {
    id: number;
    objectKey: string;
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
    maxSizeBytes: number;
    image: CollectionImageNode;
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
  position?: BoardPosition;
  provenance?: {
    provider: "pexels";
    url: string;
    downloadUrl: string;
    attribution: {
      photoId: string;
      name: string;
      username?: string;
      profileUrl: string;
    };
  };
};

export type CreateRemoteImageResponse = {
  upload: ImageUploadStatus;
};

export type ImageUploadStatusResponse = {
  upload: ImageUploadStatus;
};

export type DeleteAssetResponse = {
  deletedAssetId: string;
};

export type DeleteCollectionNodeResponse = {
  deletedNodeId: string;
  deletedAssetCount: number;
};

export type DeleteCollectionResponse = {
  deletedCollectionSlug: string;
  deletedAssetCount: number;
};

export type BulkDeleteResponse = {
  deletedCount: number;
  deletedAssetCount: number;
};

export type UpdateNodePositionInput = {
  nodeId: string;
  folderPath?: string;
  position: BoardPosition;
  expectedParentFolderNodeId: string | null;
};

export type UpdateNodePositionResponse = {
  nodeId: string;
  position: BoardPosition;
};

export type UpdateNodePositionsInput = {
  folderPath?: string;
  positions: Array<{ nodeId: string; position: BoardPosition }>;
  expectedParentFolderNodeId: string | null;
};

export type UpdateNodePositionsResponse = {
  nodeIds: string[];
};

export type MoveCollectionNodeToFolderResponse = {
  nodeId: string;
  sourceParentFolderNodeId: string | null;
  sourceFolderPath: string;
  targetParentFolderNodeId: string | null;
  targetFolderPath: string;
  position: BoardPosition | null;
  moved: boolean;
};

export type MoveCollectionNodesToFolderInput = {
  nodeIds: string[];
  folderPath?: string;
  targetFolderNodeId: string | null;
  sourceCollectionSlug?: string;
};

export type MoveCollectionNodesToFolderResponse = {
  moves: MoveCollectionNodeToFolderResponse[];
};

export type FlattenFolderResponse = {
  folderNodeId: string;
  parentFolderNodeId: string | null;
  directChildCount: number;
  position: BoardPosition | null;
};

export type CollectionNode =
  | CollectionFolderNode
  | CollectionImageNode
  | CollectionNoteNode
  | CollectionLinkNode
  | CollectionColorNode;

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
