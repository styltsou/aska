import { z } from "zod";

import type { BoardPosition } from "@/dto/collection.dto";

const OklabColorSchema = z
  .object({
    oklabL: z.number().finite().min(0).max(1),
    oklabA: z.number().finite().min(-0.5).max(0.5),
    oklabB: z.number().finite().min(-0.5).max(0.5),
    weight: z.number().finite().positive().max(1).optional(),
  })
  .strict();

const InboxColorSearchScopeSchema = z
  .object({
    type: z.literal("inbox"),
  })
  .strict();

const CollectionColorSearchScopeSchema = z
  .object({
    type: z.literal("collection"),
    collectionSlug: z.string().min(1).max(255),
    folderPath: z.string().min(1).max(2_000).optional(),
    includeDescendants: z.boolean(),
  })
  .strict();

/**
 * Collection scopes may include descendant folders. Each result returns its
 * concrete location so clients can keep discovery contextual.
 */
export const ColorSearchScopeSchema = z.discriminatedUnion("type", [
  InboxColorSearchScopeSchema,
  CollectionColorSearchScopeSchema,
]);

export const ColorSearchRequestSchema = z
  .object({
    colors: z.array(OklabColorSchema).min(1).max(12),
    scope: ColorSearchScopeSchema,
    matchMode: z.enum(["strict", "weighted"]).default("strict"),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.matchMode === "strict" && input.colors.length > 5) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 5,
        inclusive: true,
        origin: "array",
        path: ["colors"],
        message: "Strict color search supports at most five colors",
      });
    }
  });

export type ColorSearchInput = z.infer<typeof ColorSearchRequestSchema>;
export type ColorSearchScope = z.infer<typeof ColorSearchScopeSchema>;
export type ColorSearchQueryColor = ColorSearchInput["colors"][number];
export type ColorSearchMatchMode = ColorSearchInput["matchMode"];

export type ColorSearchLocation =
  | {
      type: "inbox";
      nodeId: string;
      position: null;
    }
  | {
      type: "collection";
      collectionSlug: string;
      folderPath?: string;
      folderNames: string[];
      nodeId: string;
      position: BoardPosition | null;
    };

export type ColorSearchResult = {
  image: {
    id: string;
    url: string;
    width: number;
    height: number;
    title: string | null;
    alt: string | null;
    blurDataURL: string | null;
    dominantColors: string[];
  };
  relevance: number;
  matches: Array<{
    queryColorIndex: number;
    paletteHex: string;
    distance: number;
  }>;
  location: ColorSearchLocation;
};

export type ColorSearchResponse = {
  query: {
    colors: ColorSearchQueryColor[];
    scope: ColorSearchScope;
    matchMode: ColorSearchMatchMode;
  };
  results: ColorSearchResult[];
  meta: {
    returned: number;
    cutoff: number;
    truncated: boolean;
  };
  algorithmVersion: "oklab-color-search-v2";
};
