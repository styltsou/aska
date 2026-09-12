import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { searchWorkspace } from "./fetchers";

const SEARCH_DEBOUNCE_MS = 180;

export const workspaceSearchQueryKeys = {
  all: ["workspace-search"] as const,
  search: (
    workspaceSlug: string,
    query: string,
    recentAssetIds: readonly string[] = [],
  ) =>
    [
      ...workspaceSearchQueryKeys.all,
      workspaceSlug,
      query.trim().toLowerCase(),
      query.trim() ? "" : recentAssetIds.join(","),
    ] as const,
};

export function workspaceSearchQueryOptions(
  workspaceSlug: string,
  query: string,
  recentAssetIds: readonly string[] = [],
) {
  const normalizedQuery = query.trim();
  const recents = normalizedQuery ? [] : recentAssetIds;
  return queryOptions({
    queryKey: workspaceSearchQueryKeys.search(
      workspaceSlug,
      normalizedQuery,
      recents,
    ),
    queryFn: ({ signal }) =>
      searchWorkspace(workspaceSlug, normalizedQuery, recents, signal),
    staleTime: 30_000,
  });
}

export function useWorkspaceSearch(
  workspaceSlug: string | undefined,
  query: string,
  enabled: boolean,
  recentAssetIds: readonly string[] = [],
) {
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const result = useQuery({
    ...workspaceSearchQueryOptions(
      workspaceSlug ?? "",
      debouncedQuery,
      recentAssetIds,
    ),
    enabled: Boolean(workspaceSlug && enabled),
    placeholderData: keepPreviousData,
  });

  return {
    ...result,
    isSearching:
      enabled && (query.trim() !== debouncedQuery || result.isFetching),
  };
}
