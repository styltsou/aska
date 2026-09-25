const STORAGE_PREFIX = "aska.workspace-recent-assets:";
const MAX_RECENT_ASSETS = 12;
const ASSET_ID = /^(?:image|note|link|color|diagram)-\d+$/;

export function getRecentWorkspaceAssetIds(workspaceSlug: string): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${workspaceSlug}`);
    if (!raw) return [];
    const stored: unknown = JSON.parse(raw);
    if (!Array.isArray(stored)) return [];
    return [...new Set(stored.filter(isAssetId))].slice(0, MAX_RECENT_ASSETS);
  } catch {
    return [];
  }
}

export function recordRecentWorkspaceAsset(
  workspaceSlug: string,
  assetId: string,
) {
  if (!isAssetId(assetId)) return;
  try {
    const recentAssetIds = getRecentWorkspaceAssetIds(workspaceSlug);
    localStorage.setItem(
      `${STORAGE_PREFIX}${workspaceSlug}`,
      JSON.stringify(
        [assetId, ...recentAssetIds.filter((id) => id !== assetId)].slice(
          0,
          MAX_RECENT_ASSETS,
        ),
      ),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function isAssetId(value: unknown): value is string {
  return typeof value === "string" && ASSET_ID.test(value);
}
