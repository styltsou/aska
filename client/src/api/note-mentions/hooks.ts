import {
  queryOptions,
  type QueryClient,
  useQuery,
  useQueryClient,
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
  resolvedTarget: (
    workspaceSlug: string,
    sourceAssetId: number | undefined,
    target: { assetId: number; assetType: NoteMentionType },
  ) =>
    [
      ...noteMentionQueryKeys.all(workspaceSlug),
      "resolved-target",
      sourceAssetId ?? null,
      target.assetType,
      target.assetId,
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

type MentionIdentity = { assetId: number; assetType: NoteMentionType };

export async function resolveCachedNoteMentions(
  queryClient: QueryClient,
  workspaceSlug: string,
  sourceAssetId: number | undefined,
  targets: readonly MentionIdentity[],
  signal: AbortSignal,
) {
  const resolved: NoteMentionTarget[] = [];
  const missing: MentionIdentity[] = [];
  for (const target of targets) {
    const state = queryClient.getQueryState<NoteMentionTarget | null>(
      noteMentionQueryKeys.resolvedTarget(workspaceSlug, sourceAssetId, target),
    );
    if (
      state?.dataUpdatedAt &&
      !state.isInvalidated &&
      Date.now() - state.dataUpdatedAt < 30_000
    ) {
      if (state.data) resolved.push(state.data);
    } else {
      missing.push(target);
    }
  }

  const batches: Promise<{ targets: NoteMentionTarget[] }>[] = [];
  for (let index = 0; index < missing.length; index += RESOLVE_BATCH_SIZE) {
    batches.push(
      resolveNoteMentions(
        workspaceSlug,
        {
          sourceAssetId,
          targets: missing.slice(index, index + RESOLVE_BATCH_SIZE),
        },
        signal,
      ),
    );
  }
  const fetched = (await Promise.all(batches)).flatMap(
    (result) => result.targets,
  );
  signal.throwIfAborted();
  const byKey = new Map(
    fetched.map((target) => [`${target.assetType}:${target.assetId}`, target]),
  );
  for (const target of missing) {
    queryClient.setQueryData(
      noteMentionQueryKeys.resolvedTarget(workspaceSlug, sourceAssetId, target),
      byKey.get(`${target.assetType}:${target.assetId}`) ?? null,
    );
  }
  return [...resolved, ...fetched];
}

export function useResolvedNoteMentions(
  workspaceSlug: string | undefined,
  sourceAssetId: number | undefined,
  targets: ReadonlyArray<{ assetId: number; assetType: NoteMentionType }>,
) {
  const queryClient = useQueryClient();
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
    queryFn: ({ signal }) =>
      resolveCachedNoteMentions(
        queryClient,
        workspaceSlug!,
        sourceAssetId,
        uniqueTargets,
        signal,
      ),
    placeholderData: (previousData, previousQuery) => {
      const sameSource =
        previousQuery?.queryKey[1] === workspaceSlug &&
        previousQuery?.queryKey[3] === (sourceAssetId ?? null);
      const available = new Map(
        (sameSource ? (previousData ?? []) : []).map((target) => [
          `${target.assetType}:${target.assetId}`,
          target,
        ]),
      );
      for (const target of uniqueTargets) {
        const cached = queryClient.getQueryState<NoteMentionTarget | null>(
          noteMentionQueryKeys.resolvedTarget(
            workspaceSlug ?? "",
            sourceAssetId,
            target,
          ),
        );
        if (
          cached?.data &&
          !cached.isInvalidated &&
          Date.now() - cached.dataUpdatedAt < 30_000
        ) {
          available.set(`${target.assetType}:${target.assetId}`, cached.data);
        }
      }
      return available.size ? [...available.values()] : undefined;
    },
    enabled: Boolean(workspaceSlug && uniqueTargets.length > 0),
    staleTime: 30_000,
  });
}
