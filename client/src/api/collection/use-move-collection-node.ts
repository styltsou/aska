import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { moveCollectionNodesToFolder } from "./fetchers";
import {
  adjustCollectionAssetCount,
  getAssetPreview,
  promoteCollectionPreview,
  transitionCachedContentsForMoves,
  type CollectionContentsCacheEntry,
} from "./move-cache-transition";
import { collectionQueryKeys } from "./query-keys";
import type {
  CollectionContentsResponse,
  CollectionsData,
  MoveCollectionNodesToFolderInput,
  MoveCollectionNodesToFolderResponse,
} from "./types";
import type { WorkspaceData } from "@/api/workspace";

type MoveContext =
  | { optimistic: false }
  | {
      optimistic: true;
      previousContents: CollectionContentsCacheEntry[];
      previousCollections: CollectionsData | undefined;
      previousWorkspace: WorkspaceData | undefined;
    };

export function useMoveCollectionNodesToFolder(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();

  return useMutation<
    MoveCollectionNodesToFolderResponse,
    Error,
    MoveCollectionNodesToFolderInput,
    MoveContext
  >({
    scope: { id: `collection-node-move:${workspaceSlug}:${collectionSlug}` },
    mutationFn: async ({ nodeIds, targetFolderNodeId }) =>
      moveCollectionNodesToFolder(workspaceSlug, collectionSlug, {
        nodeIds,
        targetFolderNodeId,
      }),
    onMutate: async (variables) => {
      if (!variables.targetFolderNodeId) {
        return { optimistic: false };
      }
      const targetScope = collectionQueryKeys.contentScope(
        workspaceSlug,
        collectionSlug,
      );
      const hasSourceCollection = variables.sourceCollectionSlug !== undefined;
      const targetSlug = collectionSlug;
      const sourceSlug = hasSourceCollection
        ? variables.sourceCollectionSlug!
        : collectionSlug;
      // Counts change whenever assets enter this collection from outside it:
      // from another collection, or from Inbox.
      const changeCollectionCount =
        !hasSourceCollection || sourceSlug !== targetSlug;
      // Content transitions only apply when moving within the same collection.
      const sameCollectionMove =
        hasSourceCollection && sourceSlug === targetSlug;
      const crossCollectionMove =
        hasSourceCollection && sourceSlug !== targetSlug;
      const sourceScope = collectionQueryKeys.contentScope(
        workspaceSlug,
        sourceSlug,
      );
      const collectionsKey = collectionQueryKeys.collections(workspaceSlug);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: targetScope }),
        queryClient.cancelQueries({ queryKey: collectionsKey }),
        ...(crossCollectionMove
          ? [queryClient.cancelQueries({ queryKey: sourceScope })]
          : []),
      ]);

      const collectEntries = (scope: readonly unknown[]) =>
        queryClient
          .getQueriesData<CollectionContentsResponse>({ queryKey: scope })
          .filter(
            (entry): entry is CollectionContentsCacheEntry =>
              entry[1] !== undefined,
          );
      const previousContents = collectEntries(targetScope);
      const sourceEntries = crossCollectionMove
        ? collectEntries(sourceScope)
        : [];
      const allEntries = [...previousContents, ...sourceEntries];

      const movedNodes = variables.nodeIds.flatMap((nodeId) => {
        const node = allEntries
          .flatMap(([, contents]) => contents.nodes)
          .find((node) => node.id === nodeId);
        return node ? [node] : [];
      });
      const previousCollections =
        queryClient.getQueryData<CollectionsData>(collectionsKey);
      const previousWorkspace = queryClient.getQueryData<WorkspaceData>([
        "workspace",
        workspaceSlug,
      ]);
      let appliedContent = false;
      let appliedCounts = false;

      if (
        sameCollectionMove &&
        movedNodes.length === variables.nodeIds.length
      ) {
        const sourceEntry = findSourceEntry(
          previousContents,
          variables.folderPath,
          variables.nodeIds,
          variables.targetFolderNodeId,
        );
        const source = sourceEntry?.[1];
        const targetFolder = source?.nodes.find(
          (node) => node.id === variables.targetFolderNodeId,
        );
        if (source && targetFolder && targetFolder.type === "folder") {
          const movedNodeIds = new Set(variables.nodeIds);
          const targetFolderPath = joinFolderPath(
            variables.folderPath,
            targetFolder.slug,
          );
          const sourceParentFolderPath = getParentFolderPath(
            variables.folderPath,
          );
          const sourceFolderSlug = getCurrentFolderSlug(variables.folderPath);
          const unfilteredSource = previousContents.find(
            ([key, contents]) =>
              isUnfilteredContentsKey(key) &&
              getFolderPathFromKey(key) === variables.folderPath &&
              variables.nodeIds.every((nodeId) =>
                contents.nodes.some((node) => node.id === nodeId),
              ),
          );
          const remainingUnfilteredSourceNodes =
            unfilteredSource?.[1].nodes.filter(
              (node) => !movedNodeIds.has(node.id),
            );

          const contentUpdates = transitionCachedContentsForMoves(
            previousContents,
            {
              sourceFolderPath: variables.folderPath,
              targetFolderPath,
              sourceParentFolderPath,
              sourceFolderSlug,
              targetFolderNodeId: variables.targetFolderNodeId,
              movedNodes,
              remainingUnfilteredSourceNodes,
            },
          );
          for (const [key, contents] of contentUpdates) {
            queryClient.setQueryData<CollectionContentsResponse>(key, contents);
          }
          appliedContent = true;

          const previews = movedNodes.flatMap((node) =>
            node.type === "folder" ? [] : [getAssetPreview(node)],
          );
          if (previews.length > 0) {
            queryClient.setQueryData<CollectionsData>(
              collectionsKey,
              (current) =>
                previews.reduce(
                  (next, preview) =>
                    next
                      ? promoteCollectionPreview(next, collectionSlug, preview)
                      : next,
                  current,
                ),
            );
          }
        }
      }

      if (changeCollectionCount) {
        const nodesResolved = movedNodes.length === variables.nodeIds.length;
        // Cross-collection moves always involve assets only (folders cannot
        // leave their collection), so the asset-count delta is nodeIds.length.
        const movedAssetCount = movedNodes.reduce(
          (sum, node) => sum + (node.type === "folder" ? node.count : 1),
          0,
        );
        const delta = nodesResolved
          ? movedAssetCount
          : variables.nodeIds.length;
        if (delta > 0 && previousCollections) {
          const previews = nodesResolved
            ? movedNodes.flatMap((node) =>
                node.type === "folder" ? [] : [getAssetPreview(node)],
              )
            : [];
          queryClient.setQueryData<CollectionsData>(
            collectionsKey,
            (current) => {
              if (!current) return current;
              // Inbox has no source collection to decrement.
              const decrementSource = crossCollectionMove;
              let next = decrementSource
                ? adjustCollectionAssetCount(current, sourceSlug, -delta)
                : current;
              next = adjustCollectionAssetCount(next, collectionSlug, delta);
              return previews.reduce(
                (acc, preview) =>
                  promoteCollectionPreview(acc, collectionSlug, preview),
                next,
              );
            },
          );
          queryClient.setQueryData<WorkspaceData>(
            ["workspace", workspaceSlug],
            (current) => {
              if (
                !current ||
                !current.collections.some(
                  (collection) => collection.slug === collectionSlug,
                )
              ) {
                return current;
              }
              return {
                ...current,
                collections: current.collections.map((collection) => {
                  if (crossCollectionMove && collection.slug === sourceSlug) {
                    return {
                      ...collection,
                      assetCount: Math.max(0, collection.assetCount - delta),
                    };
                  }
                  if (collection.slug === collectionSlug) {
                    return {
                      ...collection,
                      assetCount: Math.max(0, collection.assetCount + delta),
                    };
                  }
                  return collection;
                }),
              };
            },
          );
          appliedCounts = true;
        }
      }

      if (!appliedContent && !appliedCounts) {
        return { optimistic: false };
      }

      return {
        optimistic: true,
        previousContents,
        previousCollections,
        previousWorkspace,
      };
    },
    onError: (_error, variables, context) => {
      if (!context || context.optimistic === false) {
        toast.error(getMoveErrorMessage(variables.nodeIds));
        return;
      }

      for (const [key, contents] of context.previousContents) {
        queryClient.setQueryData(key, contents);
      }
      queryClient.setQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
        context.previousCollections,
      );
      queryClient.setQueryData<WorkspaceData>(
        ["workspace", workspaceSlug],
        context.previousWorkspace,
      );
      toast.error(getMoveErrorMessage(variables.nodeIds));
    },
    onSettled: (_data, _error, variables) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.contentScope(
            workspaceSlug,
            collectionSlug,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.collections(workspaceSlug),
        }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.inbox(workspaceSlug),
        }),
        queryClient.invalidateQueries({
          queryKey: ["workspace", workspaceSlug],
        }),
      ];
      if (
        variables.sourceCollectionSlug &&
        variables.sourceCollectionSlug !== collectionSlug
      ) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: collectionQueryKeys.contentScope(
              workspaceSlug,
              variables.sourceCollectionSlug,
            ),
          }),
        );
      }
      void Promise.all(invalidations);
    },
  });
}

function findSourceEntry(
  entries: CollectionContentsCacheEntry[],
  folderPath: string | undefined,
  nodeIds: string[],
  targetFolderNodeId: string,
): CollectionContentsCacheEntry | undefined {
  return entries
    .filter(
      ([key, contents]) =>
        getFolderPathFromKey(key) === folderPath &&
        nodeIds.every((nodeId) =>
          contents.nodes.some((node) => node.id === nodeId),
        ) &&
        contents.nodes.some((node) => node.id === targetFolderNodeId),
    )
    .sort(([leftKey], [rightKey]) => leftKey.length - rightKey.length)[0];
}

function getFolderPathFromKey(key: readonly unknown[]): string | undefined {
  return typeof key[3] === "string" ? key[3] : undefined;
}

function isUnfilteredContentsKey(key: readonly unknown[]): boolean {
  return key.length === 4;
}

function getMoveErrorMessage(nodeIds: string[]): string {
  if (nodeIds.length > 1) {
    return "Unable to move the selected items into that folder.";
  }

  return nodeIds[0]?.startsWith("folder-")
    ? "Unable to move the folder into that folder."
    : "Unable to move the asset into that folder.";
}

function joinFolderPath(parentPath: string | undefined, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : slug;
}

function getParentFolderPath(
  folderPath: string | undefined,
): string | undefined {
  if (!folderPath) return undefined;

  const segments = folderPath.split("/").filter(Boolean);
  segments.pop();
  return segments.length > 0 ? segments.join("/") : undefined;
}

function getCurrentFolderSlug(
  folderPath: string | undefined,
): string | undefined {
  if (!folderPath) return undefined;
  return folderPath.split("/").filter(Boolean).at(-1);
}
