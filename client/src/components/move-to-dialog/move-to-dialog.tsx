import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  collectionContentsQueryOptions,
  type CollectionContentsResponse,
  type CollectionFolderNode,
  useCollections,
  useCreateCollection,
  useCreateFolder,
  useMoveCollectionNodesToFolder,
} from "@/api/collection";
import { getFolderChildPosition } from "@/components/canvas/canvas-node-layout";
import { CollectionPicker } from "./components/collection-picker";
import { DestinationDialog } from "./components/destination-dialog";
import { useFolderDestination } from "./hooks/use-folder-destination";
import { EMPTY_IDS, FOLDER_TYPES, MAX_MOVE_BATCH_SIZE } from "./lib/constants";
import type { MoveToDialogSource } from "./lib/types";
import { joinPath, moveSuccessMessage } from "./lib/utils";

export { type MoveToDialogSource } from "./lib/types";

export function MoveToDialog({
  open,
  onOpenChange,
  source,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: MoveToDialogSource;
  onMoved?: (nodeIds: readonly string[]) => void;
}) {
  const { workspaceSlug, nodeIds, sourceCollectionSlug, sourceFolderPath } =
    source;
  const [destinationPath, setDestinationPath] = useState<string>();
  const [selectedCollectionSlug, setSelectedCollectionSlug] =
    useState<string>();
  const [error, setError] = useState<string>();
  const includesFolder = nodeIds.some((id) => id.startsWith("folder-"));
  // Moving a folder within a collection must stay in that collection, so the
  // picker is disabled and the target is fixed.
  const lockedToSource = Boolean(sourceCollectionSlug && includesFolder);
  const {
    data: collectionsData,
    isLoading: collectionsLoading,
    isError: collectionsError,
  } = useCollections(workspaceSlug);
  const collections = collectionsData?.collections ?? [];
  const targetCollectionSlug = lockedToSource
    ? sourceCollectionSlug!
    : (selectedCollectionSlug ??
      sourceCollectionSlug ??
      collections[0]?.slug ??
      "");
  const targetCollection = collections.find(
    (collection) => collection.slug === targetCollectionSlug,
  );
  const moveNodes = useMoveCollectionNodesToFolder(
    workspaceSlug,
    targetCollectionSlug,
  );
  const createFolder = useCreateFolder(workspaceSlug, targetCollectionSlug);
  const createCollection = useCreateCollection(workspaceSlug);
  const queryClient = useQueryClient();
  const destination = useFolderDestination(
    workspaceSlug,
    targetCollectionSlug,
    destinationPath,
    open && targetCollectionSlug.length > 0,
    targetCollection?.name,
  );
  const destinationFolder = destination.breadcrumbs.at(-1);
  const targetFolderNodeId = destinationFolder
    ? `folder-${destinationFolder.id}`
    : null;
  const exceedsBatchLimit = nodeIds.length > MAX_MOVE_BATCH_SIZE;
  const canMove =
    !exceedsBatchLimit &&
    targetCollectionSlug.length > 0 &&
    !destination.isLoading &&
    !destination.isStale &&
    !destination.isError;
  const selectedFolderIds = useMemo(
    () =>
      sourceCollectionSlug && sourceCollectionSlug === targetCollectionSlug
        ? new Set(nodeIds.filter((id) => id.startsWith("folder-")))
        : EMPTY_IDS,
    [sourceCollectionSlug, nodeIds, targetCollectionSlug],
  );

  async function handleMove() {
    if (!canMove) return;
    setError(undefined);

    try {
      const result = await moveNodes.mutateAsync({
        nodeIds,
        folderPath: sourceFolderPath,
        targetFolderNodeId,
        sourceCollectionSlug,
      });
      const movedNodeIds = result.moves
        .filter((move) => move.moved)
        .map((move) => move.nodeId);
      onMoved?.(movedNodeIds);
      toast.success(moveSuccessMessage(movedNodeIds.length));
      onOpenChange(false);
    } catch (moveError) {
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Unable to move the selected items.",
      );
    }
  }

  const disabledReason = exceedsBatchLimit
    ? `Move up to ${MAX_MOVE_BATCH_SIZE} items at a time.`
    : collectionsError
      ? "Unable to load collections. Close this dialog and try again."
      : !sourceCollectionSlug && collections.length === 0 && !collectionsLoading
        ? "Create a collection before moving items from Inbox."
        : undefined;

  const description = sourceCollectionSlug
    ? includesFolder
      ? "Browse to a folder or use this collection's root as the destination."
      : "Choose a collection, then browse to a folder or use its root."
    : "Choose a collection, then open the destination folder.";

  const collectionPicker = lockedToSource ? undefined : (
    <CollectionPicker
      collections={collections}
      value={targetCollectionSlug}
      disabled={collectionsLoading || moveNodes.isPending}
      loading={collectionsLoading}
      placeholder={
        collectionsLoading ? "Loading collections..." : "Select collection"
      }
      canCreateCollection={!collectionsLoading && !collectionsError}
      onCreateCollection={async (name) => {
        const result = await createCollection.mutateAsync({ name });
        setSelectedCollectionSlug(result.collection.slug);
        setDestinationPath(undefined);
        setError(undefined);
        return result.collection.slug;
      }}
      onChange={(nextCollectionSlug) => {
        setSelectedCollectionSlug(nextCollectionSlug);
        setDestinationPath(undefined);
        setError(undefined);
      }}
    />
  );

  return (
    <DestinationDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!moveNodes.isPending) onOpenChange(nextOpen);
      }}
      title="Move to..."
      description={description}
      controls={collectionPicker}
      destination={{
        ...destination,
        isLoading: destination.isLoading || collectionsLoading,
      }}
      destinationPath={destinationPath}
      disabledFolderIds={selectedFolderIds}
      onDestinationPathChange={setDestinationPath}
      canMove={canMove}
      disabledReason={disabledReason}
      count={nodeIds.length}
      isPending={moveNodes.isPending}
      error={error}
      canCreateFolder={
        targetCollectionSlug.length > 0 &&
        !collectionsLoading &&
        !collectionsError
      }
      onCreateFolder={async (name) => {
        const result = await createFolder.mutateAsync({
          name,
          parentFolderPath: destinationPath,
          placement: sourceCollectionSlug
            ? { position: getFolderChildPosition(destination.folders) }
            : undefined,
        });
        if (sourceCollectionSlug) {
          const slug = result.folder.slug;
          const newFolderPath = joinPath(destinationPath, slug);
          const newFolderNode: CollectionFolderNode = {
            id: `folder-${result.folder.id}`,
            type: "folder",
            name: result.folder.name,
            slug,
            count: 0,
            folderCount: 0,
            previews: result.folder.previews,
            position: result.folder.position,
          };
          queryClient.setQueryData<CollectionContentsResponse>(
            collectionContentsQueryOptions(
              workspaceSlug,
              targetCollectionSlug,
              newFolderPath,
              FOLDER_TYPES,
            ).queryKey,
            {
              collection: {
                id: targetCollection?.id ?? result.folder.id,
                name: destination.collectionName,
                slug: targetCollectionSlug,
              },
              breadcrumbs: [
                ...destination.breadcrumbs,
                { id: result.folder.id, name: result.folder.name, slug },
              ],
              nodes: [],
            },
          );
          queryClient.setQueryData<CollectionContentsResponse>(
            collectionContentsQueryOptions(
              workspaceSlug,
              targetCollectionSlug,
              destinationPath,
              FOLDER_TYPES,
            ).queryKey,
            (current) => {
              if (
                !current ||
                current.nodes.some((node) => node.id === newFolderNode.id)
              ) {
                return current;
              }
              return { ...current, nodes: [...current.nodes, newFolderNode] };
            },
          );
        }
        return result.folder.slug;
      }}
      onMove={() => void handleMove()}
    />
  );
}
