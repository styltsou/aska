import type { AssetLocation } from "@/api/collection/types";

export type WorkspaceSearchResultType =
  | "image"
  | "note"
  | "link"
  | "color"
  | "folder"
  | "collection";

export type WorkspaceSearchResult = {
  id: string;
  type: WorkspaceSearchResultType;
  label: string;
  snippet: string | null;
  locationLabel: string;
  location: AssetLocation;
  action:
    | { type: "open-asset" }
    | { type: "navigate" }
    | { type: "external"; url: string };
  preview: {
    hex?: string;
    blurDataURL?: string;
    hostname?: string;
  } | null;
};

export type WorkspaceSearchResponse = {
  query: string;
  results: WorkspaceSearchResult[];
};
