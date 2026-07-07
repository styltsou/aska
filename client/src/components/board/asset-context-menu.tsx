import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Asset } from "@/types/asset";

function sharedActions() {
  return (
    <>
      <ContextMenuItem>Copy link to asset</ContextMenuItem>
    </>
  );
}

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

export function AssetContextMenu({ asset, children }: { asset: Asset; children: React.ReactNode }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          {sharedActions()}
          <ContextMenuSeparator />
          {typeActions[asset.type]()}
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-red-600! hover:bg-red-500/20! focus:bg-red-500/20! data-highlighted:bg-red-500/20! dark:!text-red-400 dark:hover:!bg-red-500/30 dark:focus:!bg-red-500/30 dark:data-highlighted:!bg-red-500/30"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
