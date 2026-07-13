export type LightCollection = {
  id: number;
  name: string;
  slug: string;
  assetCount: number;
};

export type WorkspaceInfo = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

export type WorkspaceData = {
  workspace: WorkspaceInfo;
  collections: LightCollection[];
};
