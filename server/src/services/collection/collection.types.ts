export type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

export type CreatedCollectionRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

import type { FolderChildPreview } from "@/dto/collection.dto";

export type DetailedCollectionRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  previews: FolderChildPreview[];
};

export type DeleteCollectionNodeResult = {
  deletedNodeId: string;
  deletedAssetCount: number;
};
