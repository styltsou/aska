import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanIcon } from "lucide-react";
import { CreateNoteDialog } from "@/components/app-shell/create-note-dialog";
import { ColorEditorDialog } from "@/components/app-shell/color-editor-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";
import { useActiveModalLayer } from "@/hooks/use-active-modal-layer";
import { readClipboardAssetPayload } from "@/lib/clipboard";
import { useBoardAssetActions } from "./use-board-asset-actions";
import { useTransientStore, usePersistedStore } from "@/store";
import { cn } from "@/lib/utils";
import { formatPlatformShortcut } from "@/lib/platform";
import { getBoardViewportCenterPlacement } from "@/components/canvas/board-pointer-position";
import { useCanvasActions } from "@/components/canvas/canvas-actions-context";
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
  disabled = false,
  children,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: "collection" | "inbox";
  boardKey?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const position = useTransientStore((state) =>
    boardKey ? state.insertionPositions[boardKey] : undefined,
  );
  const visibleBounds = useTransientStore((state) =>
    boardKey ? state.boardVisibleBounds[boardKey] : undefined,
  );
  const viewportActivity = useTransientStore((state) =>
    boardKey ? (state.canvasViewportActivity[boardKey] ?? 0) : 0,
  );
  const contextMenuActionsRef = useRef<{
    close: () => void;
    unmount: () => void;
  } | null>(null);
  const previousViewportActivityRef = useRef(viewportActivity);
  const placement = useMemo(
    () =>
      position
        ? { position, collisionBehavior: "preserve-anchor" as const }
        : getBoardViewportCenterPlacement(visibleBounds),
    [position, visibleBounds],
  );
  const { addClipboardAsset, isPending } = useBoardAssetActions({
    workspaceSlug,
    collectionPath,
    target,
    placement,
  });
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const hasActiveModalLayer = useActiveModalLayer();

  const canvasActions = useCanvasActions();
  const isCanvasLocked = usePersistedStore((state) =>
    boardKey ? (state.boardLocks[boardKey] ?? false) : false,
  );
  const setCanvasLock = usePersistedStore((state) => state.setBoardLock);
  const areAlignmentGuidesEnabled = usePersistedStore(
    (state) => state.workspaceAlignmentGuides[workspaceSlug] ?? true,
  );
  const setWorkspaceAlignmentGuides = usePersistedStore(
    (state) => state.setWorkspaceAlignmentGuides,
  );
  const isBoardActionRailVisible = usePersistedStore(
    (state) => state.workspaceBoardActionRails?.[workspaceSlug] ?? false,
  );
  const setWorkspaceBoardActionRail = usePersistedStore(
    (state) => state.setWorkspaceBoardActionRail,
  );

  useEffect(() => {
    if (previousViewportActivityRef.current === viewportActivity) return;
    previousViewportActivityRef.current = viewportActivity;
    contextMenuActionsRef.current?.close();
  }, [viewportActivity]);

  async function handlePasteAsset() {
    try {
      await addClipboardAsset(await readClipboardAssetPayload());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Unable to paste from clipboard.",
      );
    }
  }

  const pasteItem = (
    <ContextMenuItem
      disabled={isPending}
      onClick={() => void handlePasteAsset()}
    >
      Paste
      <ContextMenuShortcut>{formatPlatformShortcut("⌘+V")}</ContextMenuShortcut>
    </ContextMenuItem>
  );

  return (
    <>
      <ContextMenu
        actionsRef={contextMenuActionsRef}
        disabled={hasActiveModalLayer || disabled}
      >
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
        <ContextMenuContent data-canvas-menu={boardKey}>
          {target === "inbox" ? (
            <>
              <ContextMenuItem onClick={() => setUploadDialogOpen(true)}>
                Upload images
                <ContextMenuShortcut>
                  {formatPlatformShortcut("⇧+U")}
                </ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setNoteDialogOpen(true)}>
                New note
                <ContextMenuShortcut>
                  {formatPlatformShortcut("⇧+N")}
                </ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => setColorDialogOpen(true)}>
                New color
              </ContextMenuItem>
              <ContextMenuSeparator />
              {pasteItem}
            </>
          ) : (
            <>
              <ContextMenuItem onClick={() => canvasActions.current?.fitView()}>
                <ScanIcon />
                Fit in view
                <ContextMenuShortcut>1</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem
                closeOnClick
                checked={isBoardActionRailVisible}
                onCheckedChange={(visible) =>
                  setWorkspaceBoardActionRail(workspaceSlug, visible === true)
                }
              >
                Actions dock
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                closeOnClick
                checked={isCanvasLocked}
                onCheckedChange={(locked) =>
                  setCanvasLock(boardKey as string, locked === true)
                }
              >
                Lock canvas
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                closeOnClick
                checked={areAlignmentGuidesEnabled}
                onCheckedChange={(enabled) =>
                  setWorkspaceAlignmentGuides(workspaceSlug, enabled === true)
                }
              >
                Alignment guides
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
              {pasteItem}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {target === "inbox" ? (
        <>
          <CreateNoteDialog
            workspaceSlug={workspaceSlug}
            collectionPath={collectionPath}
            target={target}
            open={noteDialogOpen}
            onOpenChange={setNoteDialogOpen}
            placement={placement}
          />
          <ColorEditorDialog
            workspaceSlug={workspaceSlug}
            collectionPath={collectionPath}
            target={target}
            open={colorDialogOpen}
            onOpenChange={setColorDialogOpen}
            placement={placement}
          />
          <UploadImagesDialog
            workspaceSlug={workspaceSlug}
            collectionPath={collectionPath}
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            placement={placement}
          />
        </>
      ) : null}
    </>
  );
}
