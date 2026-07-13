import { z } from "zod";

import { env } from "@/config";

export const AllowedImageContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const CreateImageUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(AllowedImageContentTypes),
  sizeBytes: z.number().int().positive().max(env.MAX_DIRECT_UPLOAD_BYTES),
  title: z.string().min(1).max(255).optional(),
  alt: z.string().max(1000).optional(),
  parentFolderPath: z.string().optional(),
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

export const ImagePipelineCallbackSchema = z.discriminatedUnion("status", [
  PipelineBaseSchema.extend({
    status: z.literal("processing"),
  }),
  PipelineBaseSchema.extend({
    status: z.literal("completed"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.string().min(1).max(32),
    blurDataURL: z.string().min(1),
    extractionVersion: z.number().int().positive(),
    palette: z.array(PipelineColorSchema).max(16),
    variants: z.array(PipelineVariantSchema).length(2),
  }),
  PipelineBaseSchema.extend({
    status: z.literal("failed"),
    error: z.string().min(1).max(1000),
  }),
]);

export type ImagePipelineCallbackInput = z.infer<
  typeof ImagePipelineCallbackSchema
>;

export const CreateRemoteImageSchema = z.object({
  url: z.url(),
  title: z.string().min(1).max(255).optional(),
  alt: z.string().max(1000).optional(),
  parentFolderPath: z.string().optional(),
});

export type CreateRemoteImageInput = z.infer<typeof CreateRemoteImageSchema>;

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
  }),
});

export type CreateImageUploadResponse = z.infer<
  typeof CreateImageUploadResponseSchema
>;
