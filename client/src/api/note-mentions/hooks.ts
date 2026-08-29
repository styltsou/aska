import { useQuery } from "@tanstack/react-query";

import { resolveNoteMentions } from "./fetchers";
import type { NoteMentionTarget, NoteMentionType } from "./types";

const RESOLVE_BATCH_SIZE = 100;

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
};

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
