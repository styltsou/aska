import { z } from "zod";

import type { BoardPosition } from "@/dto/collection.dto";

const OklabColorSchema = z
  .object({
    oklabL: z.number().finite().min(0).max(1),
    oklabA: z.number().finite().min(-0.5).max(0.5),
    oklabB: z.number().finite().min(-0.5).max(0.5),
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
    includeDescendants: z.literal(false),
  })
  .strict();

/**
 * The first increment deliberately supports only the current Inbox or board.
 * Recursive and workspace scopes require result navigation that does not yet
 * exist in the canvas client.
 */
export const ColorSearchScopeSchema = z.discriminatedUnion("type", [
  InboxColorSearchScopeSchema,
  CollectionColorSearchScopeSchema,
]);

export const ColorSearchRequestSchema = z
  .object({
    colors: z.array(OklabColorSchema).min(1).max(5),
    scope: ColorSearchScopeSchema,
  })
  .strict();

export type ColorSearchInput = z.infer<typeof ColorSearchRequestSchema>;
export type ColorSearchScope = z.infer<typeof ColorSearchScopeSchema>;
export type ColorSearchQueryColor = ColorSearchInput["colors"][number];

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
  };
  results: ColorSearchResult[];
  meta: {
    returned: number;
    cutoff: number;
    truncated: boolean;
  };
  algorithmVersion: "oklab-color-search-v1";
};
