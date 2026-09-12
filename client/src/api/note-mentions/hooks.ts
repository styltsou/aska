import {
  queryOptions,
  type QueryClient,
  type QueryKey,
  useQuery,
} from "@tanstack/react-query";

import {
  fetchNoteBacklinks,
  fetchNoteBacklinkSummary,
  resolveNoteMentions,
  searchNoteMentions,
} from "./fetchers";
import type {
  MentionSearchInput,
  NoteMentionTarget,
  NoteMentionType,
} from "./types";

const RESOLVE_BATCH_SIZE = 100;
const MENTION_SEARCH_STALE_TIME = 30_000;
const MENTION_SEARCH_GC_TIME = 5 * 60_000;
export const RECENT_MENTION_LIMIT = 15;
export const MENTION_SEARCH_LIMIT = 10;

export const noteMentionQueryKeys = {
  all: (workspaceSlug: string) => ["note-mentions", workspaceSlug] as const,
  resolve: (
    workspaceSlug: string,
    sourceAssetId: number | undefined,
    signature: string,
  ) =>
    [
      ...noteMentionQueryKeys.all(workspaceSlug),
      "resolve",
      sourceAssetId ?? null,
      signature,
    ] as const,
  backlinkSummary: (workspaceSlug: string, assetId: string) =>
    [
      ...noteMentionQueryKeys.all(workspaceSlug),
      "backlinks",
      assetId,
      "summary",
    ] as const,
  backlinks: (workspaceSlug: string, assetId: string) =>
    [...noteMentionQueryKeys.all(workspaceSlug), "backlinks", assetId] as const,
  search: (
    workspaceSlug: string,
    sourceAssetId: number | undefined,
    input: MentionSearchInput,
  ) =>
    [
      ...noteMentionQueryKeys.all(workspaceSlug),
      "search",
      sourceAssetId ?? null,
      input.q.trim().toLowerCase(),
      input.types ? [...input.types].sort().join(",") : "all",
      input.limit ?? MENTION_SEARCH_LIMIT,
    ] as const,
};

export function mentionSearchQueryOptions(
  workspaceSlug: string,
  input: MentionSearchInput,
) {
  return queryOptions({
    queryKey: noteMentionQueryKeys.search(
      workspaceSlug,
      input.sourceAssetId,
      input,
    ),
    queryFn: ({ signal }) => searchNoteMentions(workspaceSlug, input, signal),
    staleTime: MENTION_SEARCH_STALE_TIME,
    gcTime: MENTION_SEARCH_GC_TIME,
  });
}

export function isMentionSearchCacheFresh(
  queryClient: QueryClient,
  queryKey: QueryKey,
) {
  const state = queryClient.getQueryState(queryKey);
  return Boolean(
    state?.dataUpdatedAt &&
    !state.isInvalidated &&
    Date.now() - state.dataUpdatedAt < MENTION_SEARCH_STALE_TIME,
  );
}

export function invalidateMentionSuggestionQueries(
  queryClient: QueryClient,
  workspaceSlug: string,
) {
  return queryClient.invalidateQueries({
    queryKey: noteMentionQueryKeys.all(workspaceSlug),
  });
}

export function useNoteBacklinkSummary(
  workspaceSlug: string | undefined,
  assetId: string | undefined,
) {
  return useQuery({
    queryKey: noteMentionQueryKeys.backlinkSummary(
      workspaceSlug ?? "",
      assetId ?? "",
    ),
    queryFn: ({ signal }) =>
      fetchNoteBacklinkSummary(workspaceSlug!, assetId!, signal),
    enabled: Boolean(workspaceSlug && assetId),
    staleTime: 30_000,
  });
}

export function useNoteBacklinks(
  workspaceSlug: string | undefined,
  assetId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: noteMentionQueryKeys.backlinks(
      workspaceSlug ?? "",
      assetId ?? "",
    ),
    queryFn: ({ signal }) =>
      fetchNoteBacklinks(workspaceSlug!, assetId!, signal),
    enabled: Boolean(workspaceSlug && assetId && enabled),
    staleTime: 30_000,
  });
}

export function useResolvedNoteMentions(
  workspaceSlug: string | undefined,
  sourceAssetId: number | undefined,
  targets: ReadonlyArray<{ assetId: number; assetType: NoteMentionType }>,
) {
  const uniqueTargets = [
    ...new Map(
      targets.map((target) => [
        `${target.assetType}:${target.assetId}`,
        target,
      ]),
    ).values(),
  ].sort(
    (left, right) =>
      left.assetId - right.assetId ||
      left.assetType.localeCompare(right.assetType),
  );
  const signature = uniqueTargets
    .map((target) => `${target.assetType}:${target.assetId}`)
    .join(",");
  return useQuery({
    queryKey: noteMentionQueryKeys.resolve(
      workspaceSlug ?? "",
      sourceAssetId,
      signature,
    ),
    queryFn: async ({ signal }) => {
      const batches: Promise<{ targets: NoteMentionTarget[] }>[] = [];
      for (
        let index = 0;
        index < uniqueTargets.length;
        index += RESOLVE_BATCH_SIZE
      ) {
        batches.push(
          resolveNoteMentions(
            workspaceSlug!,
            {
              sourceAssetId,
              targets: uniqueTargets.slice(index, index + RESOLVE_BATCH_SIZE),
            },
            signal,
          ),
        );
      }
      const results = await Promise.all(batches);
      return results.flatMap((result) => result.targets);
    },
    enabled: Boolean(workspaceSlug && uniqueTargets.length > 0),
    staleTime: 30_000,
  });
}
