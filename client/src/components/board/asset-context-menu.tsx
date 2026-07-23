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
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeleteAsset, useDeleteCollectionNode } from "@/api/collection";
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

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setMoveDialogOpen(true)}>
            Move to...
          </ContextMenuItem>
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
      <MoveToDialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen} />
    </>
  );
}

type MockPreview = { type: "image" | "note"; color?: string; snippet?: string };

type MockFolder = {
  id: string;
  name: string;
  slug: string;
  count: number;
  previews: MockPreview[];
};

const MOCK_COLLECTIONS = [
  { id: 1, name: "Design System", slug: "design-system" },
  { id: 2, name: "Marketing", slug: "marketing" },
  { id: 3, name: "Personal", slug: "personal" },
];

const MOCK_FOLDERS: Record<number, MockFolder[]> = {
  1: [
    {
      id: "f1",
      name: "Components",
      slug: "components",
      count: 12,
      previews: [
        { type: "note", color: "#fef3c7", snippet: "Button states" },
        { type: "note", color: "#dbeafe", snippet: "Card layout" },
        { type: "image" },
      ],
    },
    {
      id: "f2",
      name: "Icons",
      slug: "icons",
      count: 8,
      previews: [{ type: "image" }, { type: "image" }],
    },
    {
      id: "f3",
      name: "Screenshots",
      slug: "screenshots",
      count: 24,
      previews: [
        { type: "image" },
        { type: "image" },
        { type: "image" },
        { type: "image" },
      ],
    },
  ],
  2: [
    {
      id: "f4",
      name: "Social",
      slug: "social",
      count: 6,
      previews: [{ type: "note", color: "#fce7f3", snippet: "Q2 campaign" }],
    },
  ],
  3: [],
};

function FolderPreviewRow({ previews }: { previews: MockPreview[] }) {
  const visible = previews.slice(0, 3);
  const remaining = Math.max(0, previews.length - 3);

  return (
    <div className="flex gap-0.5">
      {visible.map((preview, i) =>
        preview.type === "note" ? (
          <div
            key={i}
            className="size-7 overflow-hidden rounded-[3px] border"
            style={{ backgroundColor: preview.color ?? "#f0f0f0" }}
          >
            {preview.snippet && (
              <span className="line-clamp-2 block px-1 pt-1 text-[6px] leading-[1.1] text-[#666] opacity-60">
                {preview.snippet}
              </span>
            )}
          </div>
        ) : (
          <div
            key={i}
            className="size-7 rounded-[3px] bg-gradient-to-br from-sidebar-foreground/8 to-sidebar-foreground/3 ring-1 ring-sidebar-foreground/5 ring-inset"
          />
        ),
      )}
      {remaining > 0 && (
        <div className="flex size-7 items-center justify-center rounded-[3px] bg-sidebar-foreground/5 text-[10px] font-medium text-sidebar-foreground/40">
          +{remaining}
        </div>
      )}
    </div>
  );
}

function MoveToDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedCollection, setSelectedCollection] = useState(
    MOCK_COLLECTIONS[0]!.id,
  );

  const folders = MOCK_FOLDERS[selectedCollection] ?? [];

  function handleMoveToRoot() {
    const collection = MOCK_COLLECTIONS.find(
      (c) => c.id === selectedCollection,
    );
    toast.success(`Moved to ${collection!.name} root`);
    onOpenChange(false);
  }

  function handleMoveToFolder(folderName: string) {
    const collection = MOCK_COLLECTIONS.find(
      (c) => c.id === selectedCollection,
    );
    toast.success(`Moved to ${collection!.name} / ${folderName}`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogBody className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Move to...</DialogTitle>
            <DialogDescription>
              Pick a collection and destination folder.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={String(selectedCollection)}
            onValueChange={(v) => setSelectedCollection(Number(v))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOCK_COLLECTIONS.map((collection) => (
                <SelectItem key={collection.id} value={String(collection.id)}>
                  {collection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="max-h-72 space-y-0.5 overflow-y-auto">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-sidebar-foreground/5"
              onClick={handleMoveToRoot}
            >
              <div className="flex size-7 items-center justify-center rounded-[3px] bg-sidebar-foreground/5 text-xs text-sidebar-foreground/40">
                /
              </div>
              <span className="text-muted-foreground">Root</span>
            </button>
            {folders.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No folders in this collection
              </p>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-sidebar-foreground/5"
                  onClick={() => handleMoveToFolder(folder.name)}
                >
                  <FolderPreviewRow previews={folder.previews} />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate font-medium">{folder.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {folder.count}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
