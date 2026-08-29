export type NoteMentionType = "note" | "color";

export type NoteMentionTarget = {
  assetId: number;
  assetType: NoteMentionType;
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

export type NoteMentionTargetsResponse = { targets: NoteMentionTarget[] };

export type MentionSearchInput = {
  q: string;
  types?: readonly NoteMentionType[];
  limit?: number;
  sourceAssetId?: number;
};

export type MentionResolveInput = {
  sourceAssetId?: number;
  targets: Array<{ assetId: number; assetType: NoteMentionType }>;
};
