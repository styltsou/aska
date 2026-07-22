import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { HighlighterIcon, PackagePlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { RefObject } from "react";

import { useCreateNote } from "@/api/collection";
import { NoteMarkdown } from "@/components/board/cards/note-asset-card";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { markdownFromSelection } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { NoteAsset } from "@/types/asset";

const DRAWER_MIN_WIDTH = 672;
const DRAWER_MAX_WIDTH = 1344;
const DEFAULT_DRAWER_WIDTH = 800;

function getStoredWidth(): number {
  try {
    const saved = localStorage.getItem("note-drawer-width");
    if (saved) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) {
        return Math.min(Math.max(parsed, DRAWER_MIN_WIDTH), DRAWER_MAX_WIDTH);
      }
    }
  } catch {}
  return DEFAULT_DRAWER_WIDTH;
}

export function NoteDetailDrawer({
  note,
  noteExtractionTarget,
  onClose,
}: {
  note: NoteAsset | undefined;
  noteExtractionTarget?: {
    workspaceSlug: string;
    collectionSlug: string;
    parentFolderPath?: string;
  };
  onClose: () => void;
}) {
  const noteContentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(getStoredWidth);
  const widthRef = useRef(width);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const deferredContent = useDeferredValue(note?.content);
  const isContentReady = note === undefined || deferredContent === note.content;

  widthRef.current = width;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = widthRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(
        Math.max(startWidth.current + delta, DRAWER_MIN_WIDTH),
        Math.min(DRAWER_MAX_WIDTH, window.innerWidth * 0.92),
      );
      widthRef.current = newWidth;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      try {
        localStorage.setItem("note-drawer-width", String(widthRef.current));
      } catch {}
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const metrics =
    note?.wordCount !== undefined && note.readingTimeMinutes !== undefined
      ? {
          wordCount: note.wordCount,
          readingTimeMinutes: note.readingTimeMinutes,
        }
      : undefined;

  return (
    <Drawer
      open={note !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      swipeDirection="right"
    >
      <DrawerContent
        className={cn(
          "border-sidebar-border bg-sidebar text-sidebar-foreground rounded-xl border shadow-2xl duration-200 [--bleed:0px] [--drawer-bleed-background:var(--sidebar)] [--drawer-inset:0.75rem] data-ending-style:duration-150 data-starting-style:duration-200",
        )}
        style={
          { "--drawer-content-width": `${width}px` } as React.CSSProperties
        }
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className="absolute inset-y-0 left-0 z-20 w-1 -translate-x-1/2 cursor-col-resize before:absolute before:inset-y-0 before:-left-2 before:w-5 hover:bg-sidebar-foreground/10 active:bg-sidebar-foreground/20"
            onMouseDown={handleResizeStart}
          />
          <DrawerHeader className="flex-row items-center justify-between border-b border-sidebar-border p-4">
            <DrawerTitle className="sr-only">Note details</DrawerTitle>
            {metrics ? (
              <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/50">
                <span>{metrics.wordCount.toLocaleString()} words</span>
                <span className="text-sidebar-foreground/25">/</span>
                <span>
                  {metrics.readingTimeMinutes.toLocaleString()}{" "}
                  {metrics.readingTimeMinutes === 1 ? "min" : "mins"} read
                </span>
              </div>
            ) : null}
            <DrawerClose render={<Button variant="ghost" size="icon-sm" />}>
              <XIcon />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </DrawerHeader>
          <ScrollArea
            viewportRef={noteContentRef}
            className="min-h-0 flex-1 px-5 py-4 text-sm"
          >
            {noteExtractionTarget && isContentReady ? (
              <NoteSelectionToolbar
                containerRef={noteContentRef}
                active={note !== undefined}
                workspaceSlug={noteExtractionTarget.workspaceSlug}
                collectionSlug={noteExtractionTarget.collectionSlug}
                parentFolderPath={noteExtractionTarget.parentFolderPath}
                onExtract={onClose}
              />
            ) : null}
            {!isContentReady ? <NoteDrawerContentSkeleton /> : null}
            {isContentReady && deferredContent ? (
              <NoteMarkdown content={deferredContent} />
            ) : null}
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function NoteDrawerContentSkeleton() {
  return (
    <div className="space-y-4 py-0.5" role="status">
      <span className="sr-only">Loading note</span>
      <Skeleton className="h-5 w-2/5" />
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
    </div>
  );
}

type SelectionToolbarPosition = {
  left: number;
  top: number;
  placement: "top" | "bottom";
  content: string;
};

function NoteSelectionToolbar({
  containerRef,
  active,
  workspaceSlug,
  collectionSlug,
  parentFolderPath,
  onExtract,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  active: boolean;
  workspaceSlug: string;
  collectionSlug: string;
  parentFolderPath?: string;
  onExtract?: () => void;
}) {
  const [position, setPosition] = useState<SelectionToolbarPosition | null>(
    null,
  );
  const createNote = useCreateNote(workspaceSlug, collectionSlug);

  const getToolbarPosition =
    useCallback((): SelectionToolbarPosition | null => {
      if (!active) {
        return null;
      }

      const container = containerRef.current;
      const selection = window.getSelection();

      if (
        !container ||
        !selection ||
        selection.isCollapsed ||
        selection.rangeCount === 0
      ) {
        return null;
      }

      const { anchorNode, focusNode } = selection;
      const selectionIsInside =
        (!anchorNode || container.contains(anchorNode)) &&
        (!focusNode || container.contains(focusNode));

      if (!selectionIsInside) {
        return null;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const content = markdownFromSelection(range, selection).trim();

      if ((rect.width === 0 && rect.height === 0) || !content) {
        return null;
      }

      const toolbarWidth = 224;
      const toolbarOffset = 10;
      const viewportPadding = 12;
      const selectionCenter = rect.left + rect.width / 2;
      const left = Math.min(
        Math.max(selectionCenter, viewportPadding + toolbarWidth / 2),
        window.innerWidth - viewportPadding - toolbarWidth / 2,
      );
      const canFitAbove = rect.top > 52;

      return {
        left,
        top: canFitAbove
          ? rect.top - toolbarOffset
          : rect.bottom + toolbarOffset,
        placement: canFitAbove ? "top" : "bottom",
        content,
      };
    }, [active, containerRef]);

  const handleExtractAsset = useCallback(() => {
    if (!position) return;

    const content = position.content;
    onExtract?.();
    window.getSelection()?.removeAllRanges();
    setPosition(null);

    createNote.mutate(
      { content, parentFolderPath },
      {
        onError: (err) => {
          toast.error(
            err instanceof Error
              ? err.message
              : "Unable to extract note asset.",
          );
        },
      },
    );
  }, [createNote, parentFolderPath, position, onExtract]);

  useEffect(() => {
    if (!active) {
      setPosition(null);
      return;
    }

    const eventStartedInToolbar = (event: Event) =>
      event.target instanceof Element &&
      event.target.closest("[data-note-selection-toolbar]");
    const hideToolbar = (event: Event) => {
      if (eventStartedInToolbar(event)) {
        return;
      }

      setPosition(null);
    };
    const showToolbar = (event: Event) => {
      if (eventStartedInToolbar(event)) {
        return;
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setPosition(getToolbarPosition());
        });
      });
    };
    const updateVisibleToolbar = () => {
      setPosition((current) => {
        if (!current) {
          return null;
        }

        return getToolbarPosition();
      });
    };
    const scrollContainer = containerRef.current;

    document.addEventListener("selectionchange", hideToolbar);
    document.addEventListener("pointerdown", hideToolbar);
    document.addEventListener("pointerup", showToolbar);
    document.addEventListener("keyup", showToolbar);
    window.addEventListener("resize", updateVisibleToolbar);
    scrollContainer?.addEventListener("scroll", updateVisibleToolbar, {
      passive: true,
    });

    return () => {
      document.removeEventListener("selectionchange", hideToolbar);
      document.removeEventListener("pointerdown", hideToolbar);
      document.removeEventListener("pointerup", showToolbar);
      document.removeEventListener("keyup", showToolbar);
      window.removeEventListener("resize", updateVisibleToolbar);
      scrollContainer?.removeEventListener("scroll", updateVisibleToolbar);
    };
  }, [active, containerRef, getToolbarPosition]);

  if (!position) {
    return null;
  }

  return createPortal(
    <ButtonGroup
      className="fixed z-60 -translate-x-1/2 rounded-lg bg-background/90 text-foreground shadow-xl ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150"
      style={{
        left: position.left,
        top: position.top,
        transform:
          position.placement === "top"
            ? "translate(-50%, -100%)"
            : "translate(-50%, 0)",
      }}
      role="toolbar"
      aria-label="Text selection actions"
      data-note-selection-toolbar
      onMouseDown={(event) => {
        event.preventDefault();
      }}
    >
      <Button
        className="gap-1.5 px-2.5"
        variant="outline"
        size="sm"
        type="button"
        onClick={handleExtractAsset}
      >
        <PackagePlusIcon data-icon="inline-start" />
        <span>Extract asset</span>
      </Button>
      <Button
        className="gap-1.5 px-2.5"
        variant="outline"
        size="sm"
        type="button"
      >
        <HighlighterIcon data-icon="inline-start" />
        <span>Highlight</span>
      </Button>
    </ButtonGroup>,
    document.body,
  );
}
