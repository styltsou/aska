import type { WorkspaceRouteSearch } from "@/routes/$workspaceSlug/route";

export function mergeWorkspaceOverlaySearch(
  current: WorkspaceRouteSearch,
  patch: Partial<WorkspaceRouteSearch>,
): WorkspaceRouteSearch {
  return { ...current, ...patch };
}

export function openMainAssetSearchPatch({
  currentPeekId,
  nextAssetId,
  peekAfter,
  fullscreen,
}: {
  currentPeekId?: string;
  nextAssetId: string;
  peekAfter?: string;
  fullscreen: boolean;
}): Partial<WorkspaceRouteSearch> {
  return {
    asset: undefined,
    view: fullscreen ? "full" : undefined,
    ...(peekAfter
      ? {
          peek: peekAfter,
          peekScope: undefined,
          peekDescendants: undefined,
        }
      : currentPeekId === nextAssetId
        ? {
            peek: undefined,
            peekScope: undefined,
            peekDescendants: undefined,
          }
        : {}),
  };
}
