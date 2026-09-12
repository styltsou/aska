import { apiGet } from "@/lib/api";
import type { WorkspaceSearchResponse } from "./types";

export function searchWorkspace(
  workspaceSlug: string,
  query: string,
  recentAssetIds: readonly string[] = [],
  signal?: AbortSignal,
): Promise<WorkspaceSearchResponse> {
  const search = new URLSearchParams({ q: query, limit: "20" });
  if (recentAssetIds.length > 0) {
    search.set("recent", recentAssetIds.join(","));
  }
  return apiGet(
    `/api/v1/workspace/${workspaceSlug}/search?${search.toString()}`,
    { signal },
  );
}
