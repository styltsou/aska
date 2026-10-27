import { useCallback, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "aska.workspace-recent-assets:";
const MAX_RECENT_ASSETS = 12;
const ASSET_ID = /^(?:image|video|note|link|color)-\d+$/;
const RECENT_ASSETS_CHANGED_EVENT = "aska:workspace-recent-assets-changed";
const EMPTY_RECENT_ASSET_IDS: readonly string[] = [];
const cachedRecentAssetIds = new Map<string, readonly string[]>();

export function getRecentWorkspaceAssetIds(workspaceSlug: string): string[] {
  return [...getRecentWorkspaceAssetIdsSnapshot(workspaceSlug)];
}

export function useRecentWorkspaceAssetIds(
  workspaceSlug: string | undefined,
): readonly string[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!workspaceSlug) return () => undefined;

      const onRecentAssetsChanged = (event: Event) => {
        const changedWorkspaceSlug = (event as CustomEvent<string>).detail;
        if (changedWorkspaceSlug === workspaceSlug) onStoreChange();
      };
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey(workspaceSlug)) {
          cachedRecentAssetIds.delete(workspaceSlug);
          onStoreChange();
        }
      };

      window.addEventListener(
        RECENT_ASSETS_CHANGED_EVENT,
        onRecentAssetsChanged,
      );
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(
          RECENT_ASSETS_CHANGED_EVENT,
          onRecentAssetsChanged,
        );
        window.removeEventListener("storage", onStorage);
      };
    },
    [workspaceSlug],
  );
  const getSnapshot = useCallback(
    () =>
      workspaceSlug
        ? getRecentWorkspaceAssetIdsSnapshot(workspaceSlug)
        : EMPTY_RECENT_ASSET_IDS,
    [workspaceSlug],
  );

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY_RECENT_ASSET_IDS,
  );
}

function getRecentWorkspaceAssetIdsSnapshot(
  workspaceSlug: string,
): readonly string[] {
  const cached = cachedRecentAssetIds.get(workspaceSlug);
  if (cached) return cached;

  const recentAssetIds = readRecentWorkspaceAssetIds(workspaceSlug);
  cachedRecentAssetIds.set(workspaceSlug, recentAssetIds);
  return recentAssetIds;
}

function readRecentWorkspaceAssetIds(workspaceSlug: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(workspaceSlug));
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
    const nextRecentAssetIds = [
      assetId,
      ...recentAssetIds.filter((id) => id !== assetId),
    ].slice(0, MAX_RECENT_ASSETS);
    localStorage.setItem(
      storageKey(workspaceSlug),
      JSON.stringify(nextRecentAssetIds),
    );
    cachedRecentAssetIds.set(workspaceSlug, nextRecentAssetIds);
    window.dispatchEvent(
      new CustomEvent(RECENT_ASSETS_CHANGED_EVENT, { detail: workspaceSlug }),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function storageKey(workspaceSlug: string) {
  return `${STORAGE_PREFIX}${workspaceSlug}`;
}

function isAssetId(value: unknown): value is string {
  return typeof value === "string" && ASSET_ID.test(value);
}
