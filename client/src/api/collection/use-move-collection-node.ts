import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  moveCollectionNodeToFolder,
  moveCollectionNodesToFolder,
} from "./fetchers";
import {
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

type MoveContext =
  | { optimistic: false }
  | {
      optimistic: true;
      previousContents: CollectionContentsCacheEntry[];
      previousCollections: CollectionsData | undefined;
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
    mutationFn: async ({
      nodeIds,
      targetFolderNodeId,
      expectedParentFolderNodeId,
    }: MoveCollectionNodesToFolderInput) => {
      if (nodeIds.length === 1) {
        const move = await moveCollectionNodeToFolder(
          workspaceSlug,
          collectionSlug,
          nodeIds[0]!,
          {
            targetFolderNodeId,
            expectedParentFolderNodeId,
          },
        );
        return { moves: [move] };
      }

      return moveCollectionNodesToFolder(workspaceSlug, collectionSlug, {
        nodeIds,
        targetFolderNodeId,
        expectedParentFolderNodeId,
      });
    },
    onMutate: async (variables) => {
      const contentsScope = collectionQueryKeys.contentScope(
        workspaceSlug,
        collectionSlug,
      );
      const collectionsKey = collectionQueryKeys.collections(workspaceSlug);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: contentsScope }),
        queryClient.cancelQueries({ queryKey: collectionsKey }),
      ]);

      const previousContents = queryClient
        .getQueriesData<CollectionContentsResponse>({ queryKey: contentsScope })
        .filter(
          (entry): entry is CollectionContentsCacheEntry =>
            entry[1] !== undefined,
        );
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
      if (!source || !targetFolder || targetFolder.type !== "folder") {
        return { optimistic: false };
      }

      const movedNodeIds = new Set(variables.nodeIds);
      const movedNodes = variables.nodeIds.flatMap((nodeId) => {
        const movedNode = source.nodes.find((node) => node.id === nodeId);
        return movedNode ? [movedNode] : [];
      });
      if (movedNodes.length !== variables.nodeIds.length) {
        return { optimistic: false };
      }
      const targetFolderPath = joinFolderPath(
        variables.folderPath,
        targetFolder.slug,
      );
      const sourceParentFolderPath = getParentFolderPath(variables.folderPath);
      const sourceFolderSlug = getCurrentFolderSlug(variables.folderPath);
      const unfilteredSource = previousContents.find(
        ([key, contents]) =>
          isUnfilteredContentsKey(key) &&
          getFolderPathFromKey(key) === variables.folderPath &&
          variables.nodeIds.every((nodeId) =>
            contents.nodes.some((node) => node.id === nodeId),
          ),
      );
      const remainingUnfilteredSourceNodes = unfilteredSource?.[1].nodes.filter(
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

      const previousCollections =
        queryClient.getQueryData<CollectionsData>(collectionsKey);
      const previews = movedNodes.flatMap((movedNode) =>
        movedNode.type === "folder" ? [] : [getAssetPreview(movedNode)],
      );
      if (previews.length > 0) {
        queryClient.setQueryData<CollectionsData>(collectionsKey, (current) =>
          previews.reduce(
            (next, preview) =>
              next
                ? promoteCollectionPreview(next, collectionSlug, preview)
                : next,
            current,
          ),
        );
      }

      return {
        optimistic: true,
        previousContents,
        previousCollections,
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
      toast.error(getMoveErrorMessage(variables.nodeIds));
    },
    onSettled: () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.contentScope(
            workspaceSlug,
            collectionSlug,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.collections(workspaceSlug),
        }),
      ]);
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
