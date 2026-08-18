import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CreateFolderDialog } from "@/components/app-shell/create-folder-dialog";
import { CreateNoteDialog } from "@/components/app-shell/create-note-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { readClipboardAssetPayload } from "@/lib/clipboard";
import { useBoardAssetActions } from "./use-board-asset-actions";
import {
  usePersistedStore,
  useTransientStore,
  useSessionStore,
  getPexelsBrowserScope,
} from "@/store";
import { cn } from "@/lib/utils";
import { formatPlatformShortcut } from "@/lib/platform";
import { getBoardViewportCenterPlacement } from "@/components/canvas/board-pointer-position";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
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
  boardKey,
  showCanvasControls = false,
  children,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: "collection" | "inbox";
  boardKey?: string;
  showCanvasControls?: boolean;
  children: React.ReactNode;
}) {
  const position = useTransientStore((state) =>
    boardKey ? state.insertionPositions[boardKey] : undefined,
  );
  const areAlignmentGuidesEnabled = usePersistedStore((state) =>
    boardKey ? (state.boardAlignmentGuides[boardKey] ?? true) : false,
  );
  const setBoardAlignmentGuides = usePersistedStore(
    (state) => state.setBoardAlignmentGuides,
  );
  const visibleBounds = useTransientStore((state) =>
    boardKey ? state.boardVisibleBounds[boardKey] : undefined,
  );
  const placement = useMemo(
    () =>
      position ? { position } : getBoardViewportCenterPlacement(visibleBounds),
    [position, visibleBounds],
  );
  const { addClipboardAsset, isPending } = useBoardAssetActions({
    workspaceSlug,
    collectionPath,
    target,
    placement,
  });
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const hasActiveModalLayer = useActiveModalLayer();
  const openPexelsBrowser = useSessionStore(
    (state) => state.setPexelsBrowserOpen,
  );
  const pexelsScope = getPexelsBrowserScope(
    workspaceSlug,
    collectionPath.split("/")[0],
  );

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
        <ContextMenuTrigger
          className={cn(
            "block w-full",
            target === "collection"
              ? "h-full min-h-0"
              : "min-h-[calc(100svh-5rem)] md:min-h-[calc(100svh-5.5rem)]",
          )}
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setUploadDialogOpen(true)}>
            Upload images
            <ContextMenuShortcut>
              {formatPlatformShortcut("⇧+U")}
            </ContextMenuShortcut>
          </ContextMenuItem>
          {target === "collection" ? (
            <ContextMenuItem
              onClick={() => openPexelsBrowser(pexelsScope, true)}
            >
              Browse Pexels
            </ContextMenuItem>
          ) : null}
          <ContextMenuItem onClick={() => setNoteDialogOpen(true)}>
            New note
            <ContextMenuShortcut>
              {formatPlatformShortcut("⇧+N")}
            </ContextMenuShortcut>
          </ContextMenuItem>
          {target === "collection" ? (
            <>
              <ContextMenuItem onClick={() => setFolderDialogOpen(true)}>
                New folder
                <ContextMenuShortcut>
                  {formatPlatformShortcut("⇧+D")}
                </ContextMenuShortcut>
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
            <ContextMenuShortcut>
              {formatPlatformShortcut("⌘+V")}
            </ContextMenuShortcut>
          </ContextMenuItem>
          {showCanvasControls && boardKey ? (
            <>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem
                checked={areAlignmentGuidesEnabled}
                onCheckedChange={(enabled) =>
                  setBoardAlignmentGuides(boardKey, enabled === true)
                }
              >
                Alignment guides
              </ContextMenuCheckboxItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
      <CreateFolderDialog
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        placement={placement}
      />
      <CreateNoteDialog
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
        target={target}
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        placement={placement}
      />
      {target === "collection" ? (
        <UploadImagesDialog
          workspaceSlug={workspaceSlug}
          collectionPath={collectionPath}
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          placement={placement}
        />
      ) : null}
    </>
  );
}
