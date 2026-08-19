import React, { useCallback, useState } from "react";
import { shapeIntersection } from "@dnd-kit/collision";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { ImagePlusIcon, Link2Icon } from "lucide-react";
import type { BoardInsertionPlacement } from "@/api/collection";
import {
  getBoardDropPlacement,
  getBoardPastePlacement,
  getBoardViewportZoom,
} from "@/components/canvas/board-pointer-position";
import { SUPPORTED_IMAGE_MIME_TYPE_SET } from "@/constants";
import {
  PEXELS_CANVAS_DROP_TYPE,
  PEXELS_PHOTO_DRAG_TYPE,
  type PexelsPhotoDragData,
} from "@/lib/pexels-dnd";
import { getDroppedHttpUrl, getPreferredClipboardText } from "@/lib/clipboard";
import { useTransientStore } from "@/store";
import { cn, parseHttpUrl } from "@/lib/utils";
import { getPexelsDropTopLeft, PexelsDragOverlay } from "./pexels-drag-overlay";
import { useBoardAssetActions } from "./use-board-asset-actions";

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
  const [draggingKind, setDraggingKind] = useState<"image" | "link" | null>(
    null,
  );
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
            ),
          }
        : {};
      void importPexelsPhotos(photos, placement);
    },
  });

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    const kind = hasImageFile(event.dataTransfer)
      ? "image"
      : hasDraggedUrl(event.dataTransfer)
        ? "link"
        : null;
    if (!kind) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDraggingKind(kind);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDraggingKind(null);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    const hasImage = hasImageFile(event.dataTransfer);
    const url = hasImage ? undefined : getDroppedHttpUrl(event.dataTransfer);
    if (!hasImage && !url) return;
    event.preventDefault();
    setDraggingKind(null);
    const placement = boardKey
      ? getBoardDropPlacement(boardKey, { x: event.clientX, y: event.clientY })
      : {};
    if (hasImage) {
      void uploadFiles(Array.from(event.dataTransfer.files), placement);
    } else if (url) {
      void createLinkFromUrl(url, placement);
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files);
    const imageFiles = files.filter((file) =>
      SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type),
    );
    if (imageFiles.length > 0) {
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
        className={cn(
          "border-primary/50 bg-background/70 pointer-events-none absolute inset-0 z-10 flex items-center justify-center border border-dashed opacity-0 backdrop-blur-sm transition-opacity",
          draggingKind && "opacity-100",
        )}
      >
        <div className="flex items-center gap-2 rounded-lg bg-popover px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-border">
          {draggingKind === "link" ? (
            <Link2Icon className="size-4" />
          ) : (
            <ImagePlusIcon className="size-4" />
          )}
          <span>
            {draggingKind === "link"
              ? "Drop link to add"
              : "Drop images to add"}
          </span>
        </div>
      </div>
      {isPending ? (
        <span className="sr-only" aria-live="polite">
          {statusText}
        </span>
      ) : null}
    </div>
  );
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

function hasImageFile(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.items).some(
    (item) =>
      item.kind === "file" && SUPPORTED_IMAGE_MIME_TYPE_SET.has(item.type),
  );
}

function hasDraggedUrl(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).some(
    (type) => type === "text/uri-list" || type === "text/plain",
  );
}
