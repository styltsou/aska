import { useState } from "react";
import { toast } from "sonner";
import { CreateFolderDialog } from "@/components/app-shell/create-folder-dialog";
import { CreateNoteDialog } from "@/components/app-shell/create-note-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { readClipboardAssetPayload } from "@/lib/clipboard";
import { useBoardAssetActions } from "./use-board-asset-actions";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function BoardContextMenu({
  workspaceSlug,
  collectionPath,
  target = "collection",
  children,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: "collection" | "inbox";
  children: React.ReactNode;
}) {
  const { addClipboardAsset, isPending } = useBoardAssetActions({
    workspaceSlug,
    collectionPath,
    target,
  });
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const hasActiveModalLayer = useActiveModalLayer();

  async function handlePasteAsset() {
    try {
      await addClipboardAsset(await readClipboardAssetPayload());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to paste from clipboard.",
      );
    }
  }

  return (
    <>
      <ContextMenu disabled={hasActiveModalLayer}>
        <ContextMenuTrigger className="block min-h-[calc(100vh-5rem)] w-full">
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {target === "collection" ? (
            <ContextMenuItem onClick={() => setFolderDialogOpen(true)}>
              New folder
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem onClick={() => setNoteDialogOpen(true)}>
            New note
          </ContextMenuItem>
          {target === "collection" ? (
            <>
              <ContextMenuItem onClick={() => setUploadDialogOpen(true)}>
                Upload images
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          ) : (
            <ContextMenuSeparator />
          )}
          <ContextMenuItem
            disabled={isPending}
            onClick={() => void handlePasteAsset()}
          >
            Paste
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <CreateFolderDialog
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
      />
      <CreateNoteDialog
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
        target={target}
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
      />
      {target === "collection" ? (
        <UploadImagesDialog
          workspaceSlug={workspaceSlug}
          collectionPath={collectionPath}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
        />
      ) : null}
    </>
  );
}
