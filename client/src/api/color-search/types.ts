import type { OklabColor } from "@/lib/oklab";

export type { OklabColor } from "@/lib/oklab";

export type ColorSearchScope =
  | { type: "inbox" }
  | {
      type: "collection";
      collectionSlug: string;
      folderPath?: string;
      includeDescendants: boolean;
    };

export type ColorSearchMatchMode = "strict" | "weighted";

export type ColorSearchInput = {
  colors: Array<OklabColor & { weight?: number }>;
  scope: ColorSearchScope;
  matchMode?: ColorSearchMatchMode;
};

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
      position: { x: number; y: number } | null;
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
  query: ColorSearchInput;
  results: ColorSearchResult[];
  meta: {
    returned: number;
    cutoff: number;
    truncated: boolean;
  };
  algorithmVersion: "oklab-color-search-v2";
};
