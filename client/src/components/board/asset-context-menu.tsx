import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  useDeleteAsset,
  useDeleteCollectionNode,
  useFlattenFolder,
} from "@/api/collection";
import type { Asset } from "@/types/asset";
import {
  MoveToDialog,
  type MoveToDialogSource,
} from "@/components/move-to-dialog";

function imageActions() {
  return (
    <>
      <ContextMenuItem>Open original</ContextMenuItem>
      <ContextMenuItem>Copy image</ContextMenuItem>
    </>
  );
}

function noteActions() {
  return (
    <>
      <ContextMenuItem>Copy text</ContextMenuItem>
      <ContextMenuItem>Edit note</ContextMenuItem>
    </>
  );
}

function folderActions() {
  return (
    <>
      <ContextMenuItem>Open folder</ContextMenuItem>
      <ContextMenuItem>Rename folder</ContextMenuItem>
    </>
  );
}

const typeActions: Record<Asset["type"], () => React.ReactNode> = {
  image: imageActions,
  note: noteActions,
  folder: folderActions,
};

export function AssetContextMenu({
  asset,
  children,
  deleteContext,
  inboxContext,
}: {
  asset: Asset;
  children: (isContextMenuOpen: boolean) => React.ReactNode;
  deleteContext?: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
    expectedParentFolderNodeId: string | null;
  };
  inboxContext?: {
    workspaceSlug: string;
  };
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const isFavorite = asset.isFavorite ?? false;
  const removeNode = useDeleteCollectionNode(
    deleteContext?.workspaceSlug ?? "",
    deleteContext?.collectionSlug ?? "",
    deleteContext?.folderPath,
  );
  const deleteAsset = useDeleteAsset(
    inboxContext?.workspaceSlug ?? deleteContext?.workspaceSlug ?? "",
  );
  const flattenFolder = useFlattenFolder(
    deleteContext?.workspaceSlug ?? "",
    deleteContext?.collectionSlug ?? "",
  );
  const moveSource: MoveToDialogSource | undefined = deleteContext
    ? {
        workspaceSlug: deleteContext.workspaceSlug,
        sourceCollectionSlug: deleteContext.collectionSlug,
        sourceFolderPath: deleteContext.folderPath,
        nodeIds: [asset.id],
      }
    : inboxContext
      ? {
          workspaceSlug: inboxContext.workspaceSlug,
          nodeIds: [asset.id],
        }
      : undefined;

  function handleDelete() {
    setDeleteDialogOpen(false);
    if (asset.type === "folder") {
      removeNode.mutate(asset.id, {
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Unable to delete asset.",
          );
        },
      });
    } else {
      deleteAsset.mutate(asset.id, {
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Unable to delete asset.",
          );
        },
      });
    }
  }

  function handleFlatten() {
    flattenFolder.mutate(asset.id, {
      onSuccess: (result) => {
        toast.success(
          result.directChildCount === 0
            ? "Empty folder removed."
            : `Flattened ${result.directChildCount} direct ${result.directChildCount === 1 ? "item" : "items"} to the right of this canvas.`,
        );
      },
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Unable to flatten folder.",
        );
      },
    });
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={(triggerProps, state) => (
            <div {...triggerProps}>{children(state.open)}</div>
          )}
        />
        <ContextMenuContent>
          {asset.type === "folder" ? (
            <>
              {folderActions()}
              <ContextMenuItem>
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </ContextMenuItem>
              <ContextMenuSeparator />
              {moveSource ? (
                <ContextMenuItem onClick={() => setMoveDialogOpen(true)}>
                  Move to...
                </ContextMenuItem>
              ) : null}
              {deleteContext ? (
                <ContextMenuItem onClick={handleFlatten}>
                  Flatten folder
                </ContextMenuItem>
              ) : null}
            </>
          ) : (
            <>
              <ContextMenuItem>
                {isFavorite ? "Remove from favorites" : "Add to favorites"}
              </ContextMenuItem>
              {moveSource ? (
                <ContextMenuItem onClick={() => setMoveDialogOpen(true)}>
                  Move to...
                </ContextMenuItem>
              ) : null}
              <ContextMenuSeparator />
              {typeActions[asset.type]()}
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-red-600! hover:bg-red-500/20! focus:bg-red-500/20! data-highlighted:bg-red-500/20! dark:text-red-400! dark:hover:bg-red-500/30! dark:focus:bg-red-500/30! dark:data-highlighted:bg-red-500/30!"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogBody>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {asset.type === "folder" ? "Delete folder" : "Delete asset"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {asset.type === "folder"
                  ? "This deletes the folder. Assets inside it will move back to Inbox."
                  : "Are you sure you want to delete this asset? This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {moveDialogOpen && moveSource ? (
        <MoveToDialog
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
          source={moveSource}
        />
      ) : null}
    </>
  );
}
