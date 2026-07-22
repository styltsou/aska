import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { moveCollectionNodeToFolder } from "./fetchers";
import {
  getAssetPreview,
  promoteCollectionPreview,
  removeNodeFromContents,
  transitionCachedContentsForMove,
  type CollectionContentsCacheEntry,
} from "./move-cache-transition";
import { collectionQueryKeys } from "./query-keys";
import type {
  CollectionContentsResponse,
  CollectionsData,
  MoveCollectionNodeToFolderInput,
  MoveCollectionNodeToFolderResponse,
  FolderChildPreview,
} from "./types";

type MoveContext =
  | { optimistic: false }
  | {
      optimistic: true;
      previousContents: CollectionContentsCacheEntry[];
      previousCollections: CollectionsData | undefined;
    };

export function useMoveCollectionNodeToFolder(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();

  return useMutation<
    MoveCollectionNodeToFolderResponse,
    Error,
    MoveCollectionNodeToFolderInput,
    MoveContext
  >({
    scope: { id: `collection-node-move:${workspaceSlug}:${collectionSlug}` },
    mutationFn: ({
      nodeId,
      targetFolderNodeId,
      expectedParentFolderNodeId,
    }: MoveCollectionNodeToFolderInput) =>
      moveCollectionNodeToFolder(workspaceSlug, collectionSlug, nodeId, {
        targetFolderNodeId,
        expectedParentFolderNodeId,
      }),
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
        variables.nodeId,
        variables.targetFolderNodeId,
      );
      const source = sourceEntry?.[1];
      const targetFolder = source?.nodes.find(
        (node) => node.id === variables.targetFolderNodeId,
      );
      if (!source || !targetFolder || targetFolder.type !== "folder") {
        return { optimistic: false };
      }

      const removal = removeNodeFromContents(source, variables.nodeId);
      if (!removal.node) return { optimistic: false };

      const movedNode = removal.node;
      const preview: FolderChildPreview | undefined =
        movedNode.type === "folder" ? undefined : getAssetPreview(movedNode);
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
          contents.nodes.some((node) => node.id === movedNode.id),
      );
      const unfilteredRemoval = unfilteredSource
        ? removeNodeFromContents(unfilteredSource[1], movedNode.id)
        : undefined;

      const contentUpdates = transitionCachedContentsForMove(previousContents, {
        sourceFolderPath: variables.folderPath,
        targetFolderPath,
        sourceParentFolderPath,
        sourceFolderSlug,
        targetFolderNodeId: variables.targetFolderNodeId,
        movedNode,
        preview,
        remainingUnfilteredSourceNodes: unfilteredRemoval?.node
          ? unfilteredRemoval.contents.nodes
          : undefined,
      });
      for (const [key, contents] of contentUpdates) {
        queryClient.setQueryData<CollectionContentsResponse>(key, contents);
      }

      const previousCollections =
        queryClient.getQueryData<CollectionsData>(collectionsKey);
      if (preview) {
        queryClient.setQueryData<CollectionsData>(collectionsKey, (current) =>
          current
            ? promoteCollectionPreview(current, collectionSlug, preview)
            : current,
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
        toast.error(getMoveErrorMessage(variables.nodeId));
        return;
      }

      for (const [key, contents] of context.previousContents) {
        queryClient.setQueryData(key, contents);
      }
      queryClient.setQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
        context.previousCollections,
      );
      toast.error(getMoveErrorMessage(variables.nodeId));
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
  nodeId: string,
  targetFolderNodeId: string,
): CollectionContentsCacheEntry | undefined {
  return entries
    .filter(
      ([key, contents]) =>
        getFolderPathFromKey(key) === folderPath &&
        contents.nodes.some((node) => node.id === nodeId) &&
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

function getMoveErrorMessage(nodeId: string): string {
  return nodeId.startsWith("folder-")
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
