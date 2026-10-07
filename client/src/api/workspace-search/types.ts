import type { AssetLocation } from "@/api/collection/types";

export type WorkspaceSearchResultType =
  | "image"
  | "video"
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
    url?: string;
    faviconUrl?: string;
    hex?: string;
    gradient?: {
      from: string;
      to: string;
      angle: number;
      type?: "linear" | "radial";
      stops?: Array<{ color: string; position: number }>;
    };
    blurDataURL?: string;
    hostname?: string;
  } | null;
};

export type WorkspaceSearchResponse = {
  query: string;
  results: WorkspaceSearchResult[];
};
