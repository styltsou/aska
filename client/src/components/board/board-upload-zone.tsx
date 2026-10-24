import React, { useCallback, useRef, useState } from "react";
import { shapeIntersection } from "@dnd-kit/collision";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import type { BoardInsertionPlacement } from "@/api/collection";
import {
  getBoardDropPlacement,
  getBoardPastePlacement,
  getBoardViewportZoom,
} from "@/components/canvas/board-pointer-position";
import {
  SUPPORTED_IMAGE_MIME_TYPE_SET,
  SUPPORTED_VIDEO_MIME_TYPE_SET,
} from "@/constants";
import {
  PEXELS_CANVAS_DROP_TYPE,
  PEXELS_PHOTO_DRAG_TYPE,
  type PexelsPhotoDragData,
} from "@/lib/pexels-dnd";
import { getDroppedHttpUrl, getPreferredClipboardText } from "@/lib/clipboard";
import { inferVideoMime } from "@/lib/video-url";
import { useTransientStore } from "@/store";
import { cn, parseHttpUrl } from "@/lib/utils";
import { getPexelsDropTopLeft, PexelsDragOverlay } from "./pexels-drag-overlay";
import { useBoardAssetActions } from "./use-board-asset-actions";

const DROP_PREVIEW_BODY_WIDTH = 192;
const DROP_PREVIEW_BODY_HEIGHT = 128;
const DROP_PREVIEW_LABEL_HEIGHT = 32;
const DROP_PREVIEW_EDGE_GAP = 8;
const DROP_PREVIEW_POINTER_BOTTOM_GAP = 20;

export function BoardUploadZone({
  workspaceSlug,
  collectionPath,
  target = "collection",
  boardKey,
  children,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: "collection" | "inbox";
  boardKey?: string;
  children: React.ReactNode;
}) {
  const getPlacement = useCallback((): BoardInsertionPlacement | undefined => {
    if (!boardKey) return undefined;

    const { boardVisibleBounds } = useTransientStore.getState();
    return getBoardPastePlacement(boardKey, boardVisibleBounds[boardKey]);
  }, [boardKey]);
  const {
    createTextNote,
    importPexelsPhotos,
    createLinkFromUrl,
    isPending,
    statusText,
    uploadFiles,
  } = useBoardAssetActions({
    workspaceSlug,
    collectionPath,
    target,
    getPlacement,
  });
  const [isDraggingContent, setIsDraggingContent] = useState(false);
  const [dropLabelPosition, setDropLabelPosition] = useState<"top" | "bottom">(
    "top",
  );
  const dropPreviewRef = useRef<HTMLDivElement>(null);
  const pexelsDropTargetId = `pexels-canvas:${boardKey ?? target}`;
  const { ref: droppableRef, isDropTarget: isPexelsDropTarget } = useDroppable({
    id: pexelsDropTargetId,
    type: PEXELS_CANVAS_DROP_TYPE,
    accept: PEXELS_PHOTO_DRAG_TYPE,
    collisionDetector: majorityShapeIntersection,
  });

  useDragDropMonitor({
    onDragEnd(event) {
      const { operation } = event;
      if (
        event.canceled ||
        operation.target?.id !== pexelsDropTargetId ||
        operation.source?.type !== PEXELS_PHOTO_DRAG_TYPE
      ) {
        return;
      }

      const { photos } = operation.source.data as PexelsPhotoDragData;
      const placement = boardKey
        ? {
            ...getBoardDropPlacement(
              boardKey,
              getPexelsDropTopLeft({
                initialPointer: operation.position.initial,
                currentPointer: operation.position.current,
                sourceBounds: operation.source.element?.getBoundingClientRect(),
                photo: photos[0],
                zoom: getBoardViewportZoom(boardKey),
              }),
              "top-left",
            ),
            entranceAnimation: "none" as const,
          }
        : {};
      void importPexelsPhotos(photos, placement);
    },
  });

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (
      !hasDraggedFile(event.dataTransfer) &&
      !hasDraggedUrl(event.dataTransfer)
    )
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    updateDropPreviewPosition(event);
    setIsDraggingContent(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingContent(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    const files = Array.from(event.dataTransfer.files);
    const hasMedia = files.some(isSupportedMediaFile);
    const url = hasMedia ? undefined : getDroppedHttpUrl(event.dataTransfer);
    setIsDraggingContent(false);
    if (!hasMedia && !url) return;
    event.preventDefault();
    const placement = boardKey
      ? hasMedia
        ? getBoardDropPlacement(
            boardKey,
            {
              x: event.clientX,
              y: event.clientY + DROP_PREVIEW_POINTER_BOTTOM_GAP,
            },
            "bottom-center",
          )
        : getBoardDropPlacement(boardKey, {
            x: event.clientX,
            y: event.clientY,
          })
      : {};
    if (hasMedia) {
      void uploadFiles(files, placement);
    } else if (url) {
      void createLinkFromUrl(url, placement);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    if (
      !event.currentTarget.contains(event.target as Node) ||
      (event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, [contenteditable='true']"))
    )
      return;
    const files = Array.from(event.clipboardData.files);
    const mediaFiles = files.filter(
      (file) =>
        SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type) || !!inferVideoMime(file),
    );
    if (mediaFiles.length > 0) {
      event.preventDefault();
      void uploadFiles(files);
      return;
    }

    const text = getPreferredClipboardText(event.clipboardData);
    const trimmedText = text.trim();
    const url = parseHttpUrl(trimmedText);
    if (url) {
      event.preventDefault();
      void createLinkFromUrl(url);
      return;
    }

    if (trimmedText) {
      event.preventDefault();
      void createTextNote(text);
    }
  }

  return (
    <div
      ref={droppableRef}
      className={cn(
        "relative outline-none",
        target === "collection"
          ? "h-full min-h-0"
          : "min-h-[calc(100svh-5rem)] md:min-h-[calc(100svh-5.5rem)]",
      )}
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {children}
      <PexelsDragOverlay
        boardKey={boardKey}
        isOverCanvas={isPexelsDropTarget}
      />
      <div
        ref={dropPreviewRef}
        aria-hidden="true"
        data-label-position={dropLabelPosition}
        className={cn(
          "group pointer-events-none absolute z-10 flex w-48 flex-col overflow-hidden rounded-lg border border-dashed border-border/80 bg-background/45 text-foreground shadow-[0_12px_30px_-16px_rgb(0_0_0_/_0.45)] opacity-0 backdrop-blur-md transition-[opacity,border-color,background-color] duration-150 ease-out will-change-[left,top]",
          isDraggingContent && "border-primary/60 bg-primary/5 opacity-100",
        )}
      >
        <div className="flex h-8 shrink-0 items-center justify-center px-3 group-data-[label-position=bottom]:order-last">
          <span className="text-sm font-medium">Drop to place</span>
        </div>
        <div className="h-32 w-48 shrink-0" />
      </div>
      {isPending ? (
        <span className="sr-only" aria-live="polite">
          {statusText}
        </span>
      ) : null}
    </div>
  );

  function updateDropPreviewPosition(event: React.DragEvent<HTMLDivElement>) {
    const preview = dropPreviewRef.current;
    if (!preview) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const bodyTop =
      pointerY - DROP_PREVIEW_BODY_HEIGHT + DROP_PREVIEW_POINTER_BOTTOM_GAP;
    const labelPosition =
      bodyTop - DROP_PREVIEW_LABEL_HEIGHT < DROP_PREVIEW_EDGE_GAP
        ? "bottom"
        : "top";
    const desiredLeft = pointerX - DROP_PREVIEW_BODY_WIDTH / 2;
    const desiredTop =
      labelPosition === "top" ? bodyTop - DROP_PREVIEW_LABEL_HEIGHT : bodyTop;

    setDropLabelPosition(labelPosition);
    preview.style.left = `${desiredLeft}px`;
    preview.style.top = `${desiredTop}px`;
  }
}

function majorityShapeIntersection(
  input: Parameters<typeof shapeIntersection>[0],
) {
  const collision = shapeIntersection(input);
  const dragBounds = input.dragOperation.shape?.current.boundingRectangle;
  const dropBounds = input.droppable.shape?.boundingRectangle;
  if (!collision || !dragBounds || !dropBounds) return null;

  const overlapWidth = Math.max(
    0,
    Math.min(dragBounds.right, dropBounds.right) -
      Math.max(dragBounds.left, dropBounds.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(dragBounds.bottom, dropBounds.bottom) -
      Math.max(dragBounds.top, dropBounds.top),
  );
  const dragArea = dragBounds.width * dragBounds.height;
  const overlapRatio =
    dragArea > 0 ? (overlapWidth * overlapHeight) / dragArea : 0;

  return overlapRatio >= 0.55 ? { ...collision, value: overlapRatio } : null;
}

function hasDraggedFile(dataTransfer: DataTransfer): boolean {
  return (
    Array.from(dataTransfer.types).includes("Files") ||
    Array.from(dataTransfer.items).some((item) => item.kind === "file")
  );
}

function isSupportedMediaFile(file: File): boolean {
  return (
    SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type) ||
    SUPPORTED_VIDEO_MIME_TYPE_SET.has(file.type) ||
    !!inferVideoMime(file)
  );
}

function hasDraggedUrl(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).some(
    (type) => type === "text/uri-list" || type === "text/plain",
  );
}
