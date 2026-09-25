const WORKSPACE_ASSET_ID = /^(?:image|note|link|color|diagram)-\d+$/;

export function parseWorkspaceAssetId(value: unknown): string | undefined {
  return typeof value === "string" && WORKSPACE_ASSET_ID.test(value)
    ? value
    : undefined;
}
