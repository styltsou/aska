import { useMutation, useQueryClient } from "@tanstack/react-query";

import { placeAsset } from "./fetchers";
import { collectionQueryKeys } from "./query-keys";

const MAX_CONCURRENT_PLACEMENTS = 8;

export type PlaceAssetsInput = {
  assetIds: string[];
  collectionSlug: string;
  parentFolderPath?: string;
};

export type PlaceAssetsResult = {
  placedAssetIds: string[];
  failed: Array<{ assetId: string; error: Error }>;
};

/**
 * Places inbox assets through the existing single-asset endpoint with bounded
 * concurrency, then reconciles the affected caches once for the whole batch.
 */
export function usePlaceAssets(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation<PlaceAssetsResult, Error, PlaceAssetsInput>({
    scope: { id: `inbox-asset-placement:${workspaceSlug}` },
    mutationFn: async ({ assetIds, collectionSlug, parentFolderPath }) => {
      const outcomes = await mapWithConcurrency(
        assetIds,
        MAX_CONCURRENT_PLACEMENTS,
        async (assetId) => {
          try {
            await placeAsset(workspaceSlug, assetId, {
              collectionSlug,
              parentFolderPath,
            });
            return { assetId, error: undefined };
          } catch (error) {
            return {
              assetId,
              error:
                error instanceof Error
                  ? error
                  : new Error("Unable to move this asset."),
            };
          }
        },
      );

      return outcomes.reduce<PlaceAssetsResult>(
        (result, outcome) => {
          if (outcome.error) {
            result.failed.push({
              assetId: outcome.assetId,
              error: outcome.error,
            });
          } else {
            result.placedAssetIds.push(outcome.assetId);
          }
          return result;
        },
        { placedAssetIds: [], failed: [] },
      );
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;

      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.inbox(workspaceSlug),
        }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.contentScope(
            workspaceSlug,
            variables.collectionSlug,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.collections(workspaceSlug),
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace", workspaceSlug],
        }),
      ]);
    },
  });
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      worker(),
    ),
  );
  return results;
}
