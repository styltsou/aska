import { z } from "zod";

import {
  BoardPositionSchema,
  CollectionLinkNodeSchema,
} from "./collection.dto";

export const CreateLinkSchema = z.object({
  url: z.string().trim().min(1).max(4096),
  parentFolderPath: z.string().optional(),
  position: BoardPositionSchema.optional(),
});

export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;

export const LinkAssetPathParamSchema = z.object({
  workspaceSlug: z.string(),
  assetId: z.string().regex(/^link-\d+$/),
});

const PipelineClaimBaseSchema = z.object({
  id: z.number().int().positive(),
  generation: z.number().int().positive(),
});

export const ResolutionClaimSchema = PipelineClaimBaseSchema;
export const ResourceMediaClaimSchema = PipelineClaimBaseSchema;

const FieldProvenanceSchema = z.record(
  z.string(),
  z.object({ resolver: z.string().max(120), source: z.string().max(120) }),
);

const MediaDiscoverySchema = z.object({
  role: z.enum(["preview", "icon", "primary", "cover"]),
  sourceUrl: z.string().max(4096),
  sourceMetadata: z.string().max(120),
  processingProfile: z.string().max(64),
  alt: z.string().max(1000).nullable().optional(),
});

export const ResolutionResultSchema = z.discriminatedUnion("event", [
  PipelineClaimBaseSchema.extend({
    event: z.literal("resource.metadata.completed"),
    resolverKey: z.string().max(120),
    resolverVersion: z.string().max(64),
    finalUrl: z.string().max(4096),
    canonicalUrl: z.string().max(4096).nullable(),
    title: z.string().max(255).nullable(),
    description: z.string().max(2000).nullable(),
    siteName: z.string().max(255).nullable(),
    resourceKind: z.string().max(32),
    fieldProvenance: FieldProvenanceSchema,
    providerExtensions: z.record(z.string(), z.unknown()).default({}),
    media: z.array(MediaDiscoverySchema).max(4),
  }),
  PipelineClaimBaseSchema.extend({
    event: z.literal("resource.metadata.failed"),
    failureCategory: z.string().max(64),
    diagnosticCode: z.string().max(120),
    httpStatus: z.number().int().min(100).max(599).nullable().optional(),
  }),
]);

const StoredVariantSchema = z.object({
  objectKey: z.string().min(1).max(1024),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  contentType: z.string().max(120),
  sizeBytes: z.number().int().positive(),
});

export const ResourceMediaResultSchema = z.discriminatedUnion("event", [
  PipelineClaimBaseSchema.extend({
    event: z.literal("resource.media.completed"),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: z.string().max(32),
    sizeBytes: z.number().int().positive(),
    blurDataURL: z.string().nullable(),
    variants: z.object({
      master: StoredVariantSchema,
      display: StoredVariantSchema.optional(),
      preview: StoredVariantSchema.optional(),
    }),
  }),
  PipelineClaimBaseSchema.extend({
    event: z.literal("resource.media.failed"),
    failureCategory: z.string().max(64),
    diagnosticCode: z.string().max(120),
  }),
]);

export const CreateLinkResponseSchema = z.object({
  link: CollectionLinkNodeSchema,
});

export type ResolutionResultInput = z.infer<typeof ResolutionResultSchema>;
export type ResourceMediaResultInput = z.infer<
  typeof ResourceMediaResultSchema
>;
