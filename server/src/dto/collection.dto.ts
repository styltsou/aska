import { z } from "zod";

export const LightCollectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  assetCount: z.number(),
});

export type LightCollection = z.infer<typeof LightCollectionSchema>;

export const FolderChildPreviewSchema = z.object({
  assetId: z.string(),
  type: z.enum(["image", "note"]),
  url: z.string().optional(),
  blurDataURL: z.string().nullable().optional(),
  color: z.string().optional(),
  snippet: z.string().optional(),
});

export type FolderChildPreview = z.infer<typeof FolderChildPreviewSchema>;

export const DetailedCollectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assetCount: z.number(),
  previews: z.array(FolderChildPreviewSchema),
});

export type DetailedCollection = z.infer<typeof DetailedCollectionSchema>;

export const WorkspaceParamSchema = z.object({
  workspaceSlug: z.string(),
});

export const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(255),
});

export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>;

export const CreateFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentFolderPath: z.string().optional(),
});

export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

export const CreateNoteSchema = z.object({
  content: z.string().min(1).max(10_000),
  color: z.string().max(32).optional(),
  parentFolderPath: z.string().optional(),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const CreatedCollectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CreatedCollection = z.infer<typeof CreatedCollectionSchema>;

export const CollectionFolderNodeSchema = z.object({
  id: z.string(),
  type: z.literal("folder"),
  name: z.string(),
  slug: z.string(),
  count: z.number(),
  previews: z.array(FolderChildPreviewSchema),
});

export type CollectionFolderNode = z.infer<typeof CollectionFolderNodeSchema>;

export const CollectionImageNodeSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  url: z.string(),
  originalUrl: z.string().optional(),
  originalWidth: z.number().optional(),
  originalHeight: z.number().optional(),
  width: z.number(),
  height: z.number(),
  title: z.string().nullable(),
  alt: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  isFavorite: z.boolean(),
  blurDataURL: z.string().nullable().optional(),
  dominantColors: z.array(z.string()).optional(),
  sizeBytes: z.number().optional(),
  createdAt: z.string(),
});

export const CollectionNoteNodeSchema = z.object({
  id: z.string(),
  type: z.literal("note"),
  content: z.string(),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  wordCount: z.number(),
  readingTimeMinutes: z.number(),
});

export type CollectionImageNode = z.infer<typeof CollectionImageNodeSchema>;

export type CollectionNoteNode = z.infer<typeof CollectionNoteNodeSchema>;

export const CollectionNodeSchema = z.discriminatedUnion("type", [
  CollectionFolderNodeSchema,
  CollectionImageNodeSchema,
  CollectionNoteNodeSchema,
]);

export type CollectionNode = z.infer<typeof CollectionNodeSchema>;

export const BreadcrumbSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export type Breadcrumb = z.infer<typeof BreadcrumbSchema>;

export const CreatedFolderSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  path: z.string(),
  count: z.number(),
  previews: z.array(FolderChildPreviewSchema),
});

export type CreatedFolder = z.infer<typeof CreatedFolderSchema>;

export const CollectionContentsResponseSchema = z.object({
  collection: z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string(),
  }),
  breadcrumbs: z.array(BreadcrumbSchema),
  nodes: z.array(CollectionNodeSchema),
});

export type CollectionContentsResponse = z.infer<
  typeof CollectionContentsResponseSchema
>;

export const InboxContentsResponseSchema = CollectionContentsResponseSchema;

export type InboxContentsResponse = z.infer<typeof InboxContentsResponseSchema>;

export const AssetPathParamSchema = z.object({
  workspaceSlug: z.string(),
  assetId: z.string(),
});

export const PlaceAssetSchema = z.object({
  collectionSlug: z.string().min(1),
  parentFolderPath: z.string().optional(),
});

export type PlaceAssetInput = z.infer<typeof PlaceAssetSchema>;

export const CollectionPathParamSchema = z.object({
  workspaceSlug: z.string(),
  collectionSlug: z.string(),
});

export const CollectionNodePathParamSchema = CollectionPathParamSchema.extend({
  nodeId: z.string(),
});

export const FolderPathQuerySchema = z.object({
  folderPath: z.string().optional(),
});
