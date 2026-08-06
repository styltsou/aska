import { z } from "zod";

import { BoardPositionSchema } from "@/dto/collection.dto";

export const AllowedImageContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const CreateImageUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(AllowedImageContentTypes),
  sizeBytes: z.number().int().positive().max(DEFAULT_MAX_UPLOAD_BYTES),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  title: z.string().min(1).max(255).optional(),
  alt: z.string().max(1000).optional(),
  parentFolderPath: z.string().optional(),
  position: BoardPositionSchema.optional(),
});

export type CreateImageUploadInput = z.infer<typeof CreateImageUploadSchema>;

const PipelineVariantSchema = z.object({
  role: z.enum(["display", "preview"]),
  objectKey: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.literal("image/webp"),
  sizeBytes: z.number().int().positive(),
});

const PipelineColorSchema = z.object({
  hex: z.string().regex(/^#[0-9a-f]{6}$/i),
  oklabL: z.number(),
  oklabA: z.number(),
  oklabB: z.number(),
  coverage: z.number().min(0).max(1),
  salience: z.number().min(0).max(1),
  isAccent: z.boolean(),
});

const PipelineBaseSchema = z.object({
  originalObjectKey: z.string().min(1),
  originalEtag: z.string().min(1),
});

export const ImagePipelineCallbackSchema = z.discriminatedUnion("event", [
  PipelineBaseSchema.extend({
    event: z.literal("image.processing.started"),
  }),
  PipelineBaseSchema.extend({
    event: z.literal("image.variants.completed"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.string().min(1).max(32),
    blurDataURL: z.string().min(1),
    variants: z.array(PipelineVariantSchema).length(2),
  }),
  PipelineBaseSchema.extend({
    event: z.literal("image.palette.completed"),
    extractionVersion: z.number().int().positive(),
    palette: z.array(PipelineColorSchema).max(16),
  }),
  PipelineBaseSchema.extend({
    event: z.literal("image.variants.failed"),
    error: z.string().min(1).max(1000),
  }),
  PipelineBaseSchema.extend({
    event: z.literal("image.palette.failed"),
    error: z.string().min(1).max(1000),
  }),
]);

export type ImagePipelineCallbackInput = z.infer<
  typeof ImagePipelineCallbackSchema
>;

const PexelsProvenanceSchema = z.object({
  provider: z.literal("pexels"),
  url: z.url(),
  downloadUrl: z.url(),
  attribution: z.object({
    photoId: z.string().min(1),
    name: z.string().min(1).max(255),
    username: z.string().min(1).max(255),
    profileUrl: z.url(),
  }),
});

const UrlProvenanceSchema = z.object({
  provider: z.literal("url"),
  url: z.url(),
});

export const CreateRemoteImageSchema = z.object({
  url: z.url(),
  title: z.string().min(1).max(255).optional(),
  alt: z.string().max(1000).optional(),
  parentFolderPath: z.string().optional(),
  position: BoardPositionSchema.optional(),
  provenance: z
    .discriminatedUnion("provider", [
      PexelsProvenanceSchema,
      UrlProvenanceSchema,
    ])
    .optional(),
});

export type CreateRemoteImageInput = z.infer<typeof CreateRemoteImageSchema>;

export const PexelsSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(30).default(20),
});

export type PexelsSearchQuery = z.infer<typeof PexelsSearchQuerySchema>;

export const UploadPathParamSchema = z.object({
  workspaceSlug: z.string(),
  collectionSlug: z.string(),
  uploadId: z.coerce.number().int().positive(),
});

export const InboxUploadPathParamSchema = z.object({
  workspaceSlug: z.string(),
  uploadId: z.coerce.number().int().positive(),
});

export const CreateImageUploadResponseSchema = z.object({
  upload: z.object({
    id: z.number(),
    objectKey: z.string(),
    url: z.string(),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string(),
    maxSizeBytes: z.number(),
    image: z.unknown(),
  }),
});

export type CreateImageUploadResponse = z.infer<
  typeof CreateImageUploadResponseSchema
>;
