import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  useCollections,
  useDeleteAsset,
  useDeleteCollectionNode,
  usePlaceAsset,
} from "@/api/collection";
import type { Asset } from "@/types/asset";

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
  children: React.ReactNode;
  deleteContext?: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
  };
  inboxContext?: {
    workspaceSlug: string;
  };
}) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
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
  const canMoveFromInbox =
    inboxContext !== undefined && asset.type !== "folder";
  const canRemoveFromCollection =
    deleteContext !== undefined && asset.type !== "folder";

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

  function handleRemoveFromCollection() {
    if (!deleteContext) return;

    setRemoveDialogOpen(false);
    removeNode.mutate(asset.id, {
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Unable to remove asset.",
        );
      },
    });
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to...</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem disabled>Collection</ContextMenuItem>
              <ContextMenuItem disabled>Folder</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {canMoveFromInbox ? (
            <ContextMenuItem onClick={() => setMoveDialogOpen(true)}>
              Move to collection
            </ContextMenuItem>
          ) : null}
          {canRemoveFromCollection ? (
            <ContextMenuItem onClick={() => setRemoveDialogOpen(true)}>
              Remove from collection
            </ContextMenuItem>
          ) : null}
          <ContextMenuSeparator />
          {typeActions[asset.type]()}
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
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from collection</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the asset from this collection and sends it back to
              Inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleRemoveFromCollection();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {inboxContext ? (
        <MoveToCollectionDialog
          assetId={asset.id}
          workspaceSlug={inboxContext.workspaceSlug}
          open={moveDialogOpen}
          onOpenChange={setMoveDialogOpen}
        />
      ) : null}
    </>
  );
}

function MoveToCollectionDialog({
  assetId,
  workspaceSlug,
  open,
  onOpenChange,
}: {
  assetId: string;
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useCollections(workspaceSlug);
  const placeAsset = usePlaceAsset(workspaceSlug);
  const collections = data?.collections ?? [];

  function handleMove(collectionSlug: string) {
    placeAsset.mutate(
      { assetId, collectionSlug },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Unable to move asset.",
          );
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to collection</DialogTitle>
          <DialogDescription>
            Choose where this asset should live.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {isLoading ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Loading collections
            </p>
          ) : null}
          {!isLoading && collections.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              No collections yet
            </p>
          ) : null}
          {collections.map((collection) => (
            <Button
              key={collection.id}
              className="w-full justify-start"
              disabled={placeAsset.isPending}
              type="button"
              variant="ghost"
              onClick={() => handleMove(collection.slug)}
            >
              {collection.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
