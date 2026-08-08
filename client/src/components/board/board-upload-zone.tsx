import React, { useCallback, useState } from "react";
import { shapeIntersection } from "@dnd-kit/collision";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import { ImagePlusIcon } from "lucide-react";
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
    importRemoteUrl,
    isPending,
    statusText,
    uploadFiles,
  } = useBoardAssetActions({
    workspaceSlug,
    collectionPath,
    target,
    getPlacement,
  });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
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
      const visibleBounds = boardKey
        ? useTransientStore.getState().boardVisibleBounds[boardKey]
        : undefined;
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
              visibleBounds,
            ),
            allowOverlap: true,
          }
        : {};
      void importPexelsPhotos(photos, placement);
    },
  });

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFile(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingImage(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingImage(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFile(event.dataTransfer)) return;
    event.preventDefault();
    setIsDraggingImage(false);
    const visibleBounds = boardKey
      ? useTransientStore.getState().boardVisibleBounds[boardKey]
      : undefined;
    const placement = boardKey
      ? getBoardDropPlacement(
          boardKey,
          { x: event.clientX, y: event.clientY },
          visibleBounds,
        )
      : {};
    void uploadFiles(Array.from(event.dataTransfer.files), placement);
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

    const text = event.clipboardData.getData("text/plain").trim();
    const url = parseHttpUrl(text);
    if (url) {
      event.preventDefault();
      void importRemoteUrl(url);
      return;
    }

    if (text) {
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
          isDraggingImage && "opacity-100",
        )}
      >
        <div className="flex items-center gap-2 rounded-lg bg-popover px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-border">
          <ImagePlusIcon className="size-4" />
          <span>Drop images to add</span>
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
