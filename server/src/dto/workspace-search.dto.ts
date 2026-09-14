import { z } from "zod";

const WorkspaceRecentAssetIdSchema = z
  .string()
  .regex(/^(?:image|note|link|color)-\d+$/);

export const WorkspaceSearchQuerySchema = z.object({
  q: z.string().max(120).optional().default(""),
  limit: z.coerce.number().int().min(1).max(20).optional().default(20),
  recent: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? [...new Set(value.split(",").map((assetId) => assetId.trim()))]
        : [],
    )
    .pipe(z.array(WorkspaceRecentAssetIdSchema).max(12)),
});

export type WorkspaceSearchQuery = z.infer<typeof WorkspaceSearchQuerySchema>;

export type WorkspaceSearchLocation =
  | { type: "inbox" }
  | {
      type: "collection";
      collectionSlug: string;
      folderPath?: string;
    };

export type WorkspaceSearchResult = {
  id: string;
  type: "image" | "note" | "link" | "color" | "folder" | "collection";
  label: string;
  snippet: string | null;
  locationLabel: string;
  location: WorkspaceSearchLocation;
  action:
    | { type: "open-asset" }
    | { type: "navigate" }
    | { type: "external"; url: string };
  preview: {
    url?: string;
    faviconUrl?: string;
    hex?: string;
    blurDataURL?: string;
    hostname?: string;
  } | null;
};

export type WorkspaceSearchResponse = {
  query: string;
  results: WorkspaceSearchResult[];
};
