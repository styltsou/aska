import { z } from "zod";

const MentionTypeSchema = z.enum(["note", "color"]);
const NoteAssetIdSchema = z.string().regex(/^note-\d+$/);
const MentionTargetSchema = z.object({
  assetId: z.number().int().positive(),
  assetType: MentionTypeSchema,
});

export const MentionSearchQuerySchema = z.object({
  q: z.string().max(120).optional().default(""),
  types: z.preprocess(
    (value) =>
      value === undefined ? undefined : Array.isArray(value) ? value : [value],
    z.array(MentionTypeSchema).min(1).max(2).optional(),
  ),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
  sourceAssetId: z.coerce.number().int().positive().optional(),
});

export const MentionResolveSchema = z.object({
  sourceAssetId: z.number().int().positive().optional(),
  targets: z.array(MentionTargetSchema).max(100),
});

export const NoteBacklinksPathParamSchema = z.object({
  workspaceSlug: z.string(),
  assetId: NoteAssetIdSchema,
});

export type MentionType = z.infer<typeof MentionTypeSchema>;
export type MentionSearchQuery = z.infer<typeof MentionSearchQuerySchema>;
export type MentionResolveInput = z.infer<typeof MentionResolveSchema>;

export type NoteBacklink = {
  assetId: string;
  title: string;
  locationLabel: string;
  updatedAt: string;
};

export type NoteBacklinkSummaryResponse = { count: number };
export type NoteBacklinksResponse = { backlinks: NoteBacklink[] };

export type MentionTarget = {
  assetId: number;
  assetType: MentionType;
  label: string;
  title: string | null;
  noteColor: string | null;
  hex: string | null;
  gradient: {
    from: string;
    to: string;
    angle: number;
    type?: "linear" | "radial";
    stops?: Array<{ color: string; position: number }>;
  } | null;
  snippet: string | null;
  locationLabel: string;
  collectionSlug: string | null;
  folderPath: string | null;
};

export type MentionTargetsResponse = { targets: MentionTarget[] };
