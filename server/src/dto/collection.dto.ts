import { z } from "zod";

import { NOTE_CONTENT_MAX_LENGTH } from "@/constants";

export const BoardPositionSchema = z.object({
  x: z.number().int().min(-2_147_483_648).max(2_147_483_647),
  y: z.number().int().min(-2_147_483_648).max(2_147_483_647),
});

export type BoardPosition = z.infer<typeof BoardPositionSchema>;

export const LightCollectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  assetCount: z.number(),
});

export type LightCollection = z.infer<typeof LightCollectionSchema>;

export const FolderChildPreviewSchema = z.object({
  assetId: z.string(),
  type: z.enum(["image", "note", "link", "color"]),
  url: z.string().optional(),
  blurDataURL: z.string().nullable().optional(),
  color: z.string().optional(),
  hex: z.string().optional(),
  snippet: z.string().optional(),
  hostname: z.string().optional(),
  title: z.string().nullable().optional(),
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
  position: BoardPositionSchema.optional(),
});

export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;

export const CreateNoteSchema = z
  .object({
    content: z.string().max(NOTE_CONTENT_MAX_LENGTH).default(""),
    title: z.string().max(255).nullable().optional(),
    color: z.string().max(32).optional(),
    parentFolderPath: z.string().optional(),
    position: BoardPositionSchema.optional(),
  })
  .refine(
    ({ content, title }) => Boolean(content.trim() || title?.trim()),
    "A note needs a title or content",
  );

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

const HexColorSchema = z
  .string()
  .regex(
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
    "Must be a hex color like #rrggbb or #rrggbbaa",
  );

const ColorGradientSchema = z.object({
  from: HexColorSchema,
  to: HexColorSchema,
  angle: z.number().int().min(0).max(360),
  type: z.enum(["linear", "radial"]).optional(),
  stops: z
    .array(
      z.object({
        color: HexColorSchema,
        position: z.number().min(0).max(100),
      }),
    )
    .min(2)
    .max(12)
    .optional(),
});

export const CreateColorSchema = z.object({
  hex: HexColorSchema,
  gradient: ColorGradientSchema.optional(),
  parentFolderPath: z.string().optional(),
  position: BoardPositionSchema.optional(),
});

export type CreateColorInput = z.infer<typeof CreateColorSchema>;

export const UpdateColorSchema = z.object({
  hex: HexColorSchema,
  gradient: ColorGradientSchema.nullable().optional(),
});

export type UpdateColorInput = z.infer<typeof UpdateColorSchema>;

export type UpdatedColor = {
  id: string;
  type: "color";
  hex: string;
  title: string | null;
  isFavorite: boolean;
  gradient?: z.infer<typeof ColorGradientSchema> | null;
};

export const UpdateImageSchema = z.object({
  note: z.string().max(10_000).nullable(),
});

export type UpdateImageInput = z.infer<typeof UpdateImageSchema>;

export type UpdatedImage = {
  id: string;
  type: "image";
  note: string | null;
  isFavorite: boolean;
  updatedAt: string;
};

export const UpdateNoteSchema = z.object({
  content: z.string().max(NOTE_CONTENT_MAX_LENGTH).optional(),
  title: z.string().max(255).nullable().optional(),
  isExpanded: z.boolean().optional(),
});

export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;

export type UpdatedNote = {
  id: string;
  type: "note";
  content: string;
  title: string | null;
  color: string | null;
  isFavorite: boolean;
  isExpanded: boolean;
  wordCount: number;
  readingTimeMinutes: number;
  createdAt?: string;
  updatedAt: string;
};

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
  folderCount: z.number(),
  previews: z.array(FolderChildPreviewSchema),
  createdAt: z.string(),
  position: BoardPositionSchema.nullable(),
});

export type CollectionFolderNode = z.infer<typeof CollectionFolderNodeSchema>;

export const CollectionImageNodeSchema = z.object({
  id: z.string(),
  type: z.literal("image"),
  url: z.string(),
  originalUrl: z.string().optional(),
  originalWidth: z.number().optional(),
  originalHeight: z.number().optional(),
  contentType: z.string().optional(),
  width: z.number(),
  height: z.number(),
  title: z.string().nullable(),
  alt: z.string().nullable(),
  note: z.string().nullable(),
  sourceLabel: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  isFavorite: z.boolean(),
  blurDataURL: z.string().nullable().optional(),
  dominantColors: z.array(z.string()).optional(),
  variantStatus: z.enum(["processing", "completed", "failed"]).optional(),
  paletteStatus: z.enum(["processing", "completed", "failed"]).optional(),
  sizeBytes: z.number().optional(),
  createdAt: z.string(),
  position: BoardPositionSchema.nullable(),
});

export const CollectionNoteNodeSchema = z.object({
  id: z.string(),
  type: z.literal("note"),
  content: z.string(),
  title: z.string().nullable(),
  color: z.string().nullable(),
  isFavorite: z.boolean(),
  isExpanded: z.boolean().optional(),
  wordCount: z.number(),
  readingTimeMinutes: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  position: BoardPositionSchema.nullable(),
});

export const LinkResolutionStatusSchema = z.enum([
  "queued",
  "resolving",
  "partial",
  "ready",
  "failed",
]);

const YouTubeChannelUrlSchema = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
    ].includes(url.hostname.toLowerCase())
  );
});

export const LinkVideoSchema = z.object({
  provider: z.literal("youtube"),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  channelName: z.string().max(255).nullable(),
  channelUrl: YouTubeChannelUrlSchema.nullable(),
});

export type LinkVideo = z.infer<typeof LinkVideoSchema>;

export const CollectionLinkNodeSchema = z.object({
  id: z.string(),
  type: z.literal("link"),
  originalUrl: z.string(),
  canonicalUrl: z.string().nullable(),
  hostname: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  siteName: z.string().nullable(),
  resourceKind: z.string(),
  resolutionStatus: LinkResolutionStatusSchema,
  failureCategory: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  staleAt: z.string().nullable(),
  previewImage: z
    .object({
      url: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      blurDataURL: z.string().nullable().optional(),
      alt: z.string().nullable().optional(),
    })
    .nullable(),
  favicon: z
    .object({
      url: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .nullable(),
  video: LinkVideoSchema.nullable(),
  createdAt: z.string(),
  position: BoardPositionSchema.nullable(),
});

export const CollectionColorNodeSchema = z.object({
  id: z.string(),
  type: z.literal("color"),
  hex: z.string(),
  gradient: ColorGradientSchema.nullable().optional(),
  title: z.string().nullable(),
  isFavorite: z.boolean(),
  createdAt: z.string(),
  position: BoardPositionSchema.nullable(),
});

export type CollectionImageNode = z.infer<typeof CollectionImageNodeSchema>;

export type CollectionNoteNode = z.infer<typeof CollectionNoteNodeSchema>;
export type CollectionLinkNode = z.infer<typeof CollectionLinkNodeSchema>;
export type CollectionColorNode = z.infer<typeof CollectionColorNodeSchema>;

export const CollectionNodeSchema = z.discriminatedUnion("type", [
  CollectionFolderNodeSchema,
  CollectionImageNodeSchema,
  CollectionNoteNodeSchema,
  CollectionLinkNodeSchema,
  CollectionColorNodeSchema,
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
  createdAt: z.string(),
  position: BoardPositionSchema.nullable(),
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

const AssetNodeIdSchema = z.string().regex(/^(image|note|link|color)-\d+$/);
const CollectionNodeIdSchema = z
  .string()
  .regex(/^(folder|image|note|link|color)-\d+$/);
const FolderNodeIdSchema = z.string().regex(/^folder-\d+$/);

export const AssetPathParamSchema = z.object({
  workspaceSlug: z.string(),
  assetId: AssetNodeIdSchema,
});

export const ImageCropPathParamSchema = z.object({
  workspaceSlug: z.string(),
  assetId: z.string().regex(/^image-\d+$/),
});

export const CropInputSchema = z.object({
  crop: z.object({
    x: z.number().finite().int().min(0),
    y: z.number().finite().int().min(0),
    width: z.number().finite().int().positive(),
    height: z.number().finite().int().positive(),
  }),
  transform: z
    .object({
      rotation: z.number().int().min(0).max(270).multipleOf(90),
      flipX: z.boolean(),
      flipY: z.boolean(),
    })
    .default({ rotation: 0, flipX: false, flipY: false }),
});

export type CropInput = z.infer<typeof CropInputSchema>;

export const CollectionPathParamSchema = z.object({
  workspaceSlug: z.string(),
  collectionSlug: z.string(),
});

export const CollectionNodePathParamSchema = CollectionPathParamSchema.extend({
  nodeId: CollectionNodeIdSchema,
});

export const FolderNodePathParamSchema = CollectionPathParamSchema.extend({
  nodeId: FolderNodeIdSchema,
});

export const CollectionAssetNodePathParamSchema =
  CollectionPathParamSchema.extend({
    nodeId: AssetNodeIdSchema,
  });

export const MoveCollectionNodesParentSchema = z.object({
  nodeIds: z
    .array(CollectionNodeIdSchema)
    .min(1)
    .max(100)
    .refine(
      (nodeIds) => new Set(nodeIds).size === nodeIds.length,
      "Move must not contain duplicate node IDs",
    ),
  targetFolderNodeId: FolderNodeIdSchema.nullable(),
});

export type MoveCollectionNodesParentInput = z.infer<
  typeof MoveCollectionNodesParentSchema
>;

export const UpdateNodePositionSchema = z.object({
  position: BoardPositionSchema,
  expectedParentFolderNodeId: FolderNodeIdSchema.nullable(),
});

export type UpdateNodePositionInput = z.infer<typeof UpdateNodePositionSchema>;

export const UpdateNodePositionsSchema = z.object({
  positions: z
    .array(
      z.object({
        nodeId: CollectionNodeIdSchema,
        position: BoardPositionSchema,
      }),
    )
    .min(2)
    .max(100)
    .refine(
      (positions) =>
        new Set(positions.map((position) => position.nodeId)).size ===
        positions.length,
      "Node positions must not contain duplicate node IDs",
    ),
  expectedParentFolderNodeId: FolderNodeIdSchema.nullable(),
});

export type UpdateNodePositionsInput = z.infer<
  typeof UpdateNodePositionsSchema
>;

export const ContentTypeFilterSchema = z.enum([
  "image",
  "note",
  "link",
  "color",
  "folder",
]);
export type ContentTypeFilter = z.infer<typeof ContentTypeFilterSchema>;

const ContentTypesQuerySchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.length > 0
      ? value.split(",")
      : undefined,
  z.array(ContentTypeFilterSchema).min(1).max(5).optional(),
);

export const ContentTypeQuerySchema = z.object({
  types: ContentTypesQuerySchema,
});

export const CollectionContentsQuerySchema = ContentTypeQuerySchema.extend({
  folderPath: z.string().optional(),
});

export const BulkDeleteBodySchema = z.object({
  nodeIds: z
    .array(CollectionNodeIdSchema)
    .min(1)
    .max(100)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Node IDs must not contain duplicates",
    ),
  collectionSlug: z.string().optional(),
});
export type BulkDeleteInput = z.infer<typeof BulkDeleteBodySchema>;

export const BulkDeleteResultSchema = z.object({
  deletedCount: z.number(),
  deletedAssetCount: z.number(),
});
