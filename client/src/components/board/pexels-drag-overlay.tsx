import React from "react";
import { DragOverlay } from "@dnd-kit/react";
import type { PexelsPhoto } from "@/api/pexels";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { getBoardViewportZoom } from "@/components/canvas/board-pointer-position";
import { makeCanvasDropStackStyles } from "@/components/canvas/canvas-drop-stack";
import { BOARD_CARD_WIDTH } from "@/components/canvas/canvas-node-layout";
import {
  PEXELS_PHOTO_DRAG_TYPE,
  type PexelsPhotoDragData,
} from "@/lib/pexels-dnd";

const PEXELS_DRAG_PREVIEW_WIDTH = 176;

export function PexelsDragOverlay({
  boardKey,
  isOverCanvas,
}: {
  boardKey?: string;
  isOverCanvas: boolean;
}) {
  return (
    <DragOverlay
      className="pointer-events-none z-50 overflow-visible select-none"
      dropAnimation={null}
    >
      {(source) => {
        if (source.type !== PEXELS_PHOTO_DRAG_TYPE) return null;
        const { photos } = source.data as PexelsPhotoDragData;
        const photo = photos[0];
        if (!photo) return null;
        const sourceWidth =
          source.element?.getBoundingClientRect().width ??
          PEXELS_DRAG_PREVIEW_WIDTH;
        const scale =
          isOverCanvas && boardKey
            ? (BOARD_CARD_WIDTH * getBoardViewportZoom(boardKey)) / sourceWidth
            : 1;

        return (
          <div
            className="relative drop-shadow-xl transition-transform duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none"
            style={{
              width: sourceWidth,
              transform: `scale(${scale})`,
              transformOrigin: "inherit",
            }}
          >
            <PexelsDragOverlayCards photos={photos} width={sourceWidth} />
          </div>
        );
      }}
    </DragOverlay>
  );
}

const PexelsDragOverlayCards = React.memo(function PexelsDragOverlayCards({
  photos,
  width,
}: {
  photos: readonly PexelsPhoto[];
  width: number;
}) {
  const primaryPhoto = photos[0];
  const stackStyles = React.useMemo(
    () => makePexelsOverlayStackStyles(photos, width),
    [photos, width],
  );

  if (!primaryPhoto) return null;

  return (
    <div
      className="relative"
      style={{ height: getPhotoCardHeight(primaryPhoto, width) }}
    >
      {photos.map((photo) => {
        const stackStyle = stackStyles.get(photo.id);

        return (
          <div
            key={photo.id}
            className="absolute inset-x-0 top-0 rounded-lg bg-background ring-2 ring-ring ring-offset-2 ring-offset-background transition-transform duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              zIndex: stackStyle?.stackOrder,
              transform: stackStyle
                ? `translate3d(${stackStyle.translateX}px, ${stackStyle.translateY}px, 0) rotate(${stackStyle.rotation}deg) scale(${stackStyle.scale})`
                : undefined,
              transformOrigin: "bottom center",
              transitionDelay: stackStyle
                ? `${stackStyle.delayMs}ms`
                : undefined,
            }}
          >
            <PexelsDragOverlayCard photo={photo} />
          </div>
        );
      })}
    </div>
  );
});

const PexelsDragOverlayCard = React.memo(function PexelsDragOverlayCard({
  photo,
}: {
  photo: PexelsPhoto;
}) {
  const asset = React.useMemo(
    () => ({
      id: `pexels-drag-${photo.id}`,
      type: "image" as const,
      url: photo.urls.small,
      width: photo.width,
      height: photo.height,
      alt: photo.alt ?? undefined,
      sourceLabel: "pexels.com",
      sourceUrl: photo.url,
    }),
    [photo],
  );

  return (
    <div className="relative overflow-hidden rounded-lg">
      <ImageAssetCard asset={asset} />
    </div>
  );
});

export function makePexelsOverlayStackStyles(
  photos: readonly PexelsPhoto[],
  width: number,
) {
  const primaryPhoto = photos[0];
  if (!primaryPhoto) return new Map();
  if (photos.length === 1) {
    return new Map([
      [
        primaryPhoto.id,
        {
          translateX: 0,
          translateY: 0,
          rotation: 0,
          scale: 1,
          stackOrder: 1,
          delayMs: 0,
        },
      ],
    ]);
  }

  return makeCanvasDropStackStyles(
    primaryPhoto.id,
    new Map(
      photos.map((photo) => [
        photo.id,
        { x: 0, y: 0, height: getPhotoCardHeight(photo, width) },
      ]),
    ),
  );
}

function getPhotoCardHeight(photo: PexelsPhoto, width: number) {
  return width * (photo.height / photo.width);
}

export function getPexelsDropTopLeft({
  initialPointer,
  currentPointer,
  sourceBounds,
  photo,
  zoom,
}: {
  initialPointer: { x: number; y: number };
  currentPointer: { x: number; y: number };
  sourceBounds?: Pick<DOMRect, "left" | "top" | "width" | "height">;
  photo?: PexelsPhoto;
  zoom: number;
}) {
  const pointerAnchor = sourceBounds
    ? {
        x: clampRatio(
          (initialPointer.x - sourceBounds.left) / sourceBounds.width,
        ),
        y: clampRatio(
          (initialPointer.y - sourceBounds.top) / sourceBounds.height,
        ),
      }
    : { x: 0.5, y: 0.5 };
  const screenWidth = BOARD_CARD_WIDTH * zoom;
  const screenHeight = photo
    ? screenWidth * (photo.height / photo.width)
    : screenWidth;

  return {
    x: currentPointer.x - pointerAnchor.x * screenWidth,
    y: currentPointer.y - pointerAnchor.y * screenHeight,
  };
}

function clampRatio(value: number) {
  return Math.min(Math.max(value, 0), 1);
}
