import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CropIcon,
  CheckIcon,
  RotateCcwIcon,
  DownloadIcon,
  ExternalLinkIcon,
  XIcon,
} from "lucide-react";
import type { ImageAsset } from "@/types/asset";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import Cropper, { type Area, type Size } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import {
  getImageViewerLayoutId,
  IMAGE_VIEWER_TRANSITION,
} from "@/components/board/image-viewer-transition";
import { ImageMetadata } from "./image-metadata";
import { ASPECT_RATIOS, CropToolbar } from "./crop-toolbar";

const MIN_FREE_CROP_SIZE = 80;

type CropFrameColors = {
  frame: string;
  outline: string;
  className: string;
  label: string;
};

type CropDimension = "width" | "height";

function getCropFrameColors(dominantColors?: string[]): CropFrameColors {
  const colors = (dominantColors ?? [])
    .map((color) => {
      const match = /^#?([\da-f]{6})$/i.exec(color);
      if (!match) return null;

      const value = Number.parseInt(match[1], 16);
      return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
      };
    })
    .filter(
      (color): color is { r: number; g: number; b: number } => color !== null,
    );

  if (colors.length === 0) {
    return {
      frame: "var(--sidebar-foreground)",
      outline: "var(--sidebar)",
      className: "aska-crop-area aska-crop-area--theme",
      label: "Theme fallback",
    };
  }

  const totalWeight = (colors.length * (colors.length + 1)) / 2;
  const luminance =
    colors.reduce((sum, color, index) => {
      const weight = colors.length - index;
      const toLinear = (channel: number) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };

      return (
        sum +
        weight *
          (0.2126 * toLinear(color.r) +
            0.7152 * toLinear(color.g) +
            0.0722 * toLinear(color.b))
      );
    }, 0) / totalWeight;

  return luminance > 0.42
    ? {
        frame: "rgb(0 0 0)",
        outline: "rgb(255 255 255)",
        className: "aska-crop-area aska-crop-area--dark",
        label: "Black",
      }
    : {
        frame: "rgb(255 255 255)",
        outline: "rgb(0 0 0)",
        className: "aska-crop-area aska-crop-area--light",
        label: "White",
      };
}

type ResizeDirection =
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left"
  | "top-left";

const RESIZE_TARGETS: {
  direction: ResizeDirection;
  className: string;
  label: string;
}[] = [
  {
    direction: "top",
    className: "top-0 left-3 right-3 h-3 -translate-y-1/2 cursor-ns-resize",
    label: "Resize crop from top edge",
  },
  {
    direction: "right",
    className: "top-3 right-0 bottom-3 w-3 translate-x-1/2 cursor-ew-resize",
    label: "Resize crop from right edge",
  },
  {
    direction: "bottom",
    className: "right-3 bottom-0 left-3 h-3 translate-y-1/2 cursor-ns-resize",
    label: "Resize crop from bottom edge",
  },
  {
    direction: "left",
    className: "top-3 bottom-3 left-0 w-3 -translate-x-1/2 cursor-ew-resize",
    label: "Resize crop from left edge",
  },
  {
    direction: "top-left",
    className:
      "top-0 left-0 size-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    label: "Resize crop from top left corner",
  },
  {
    direction: "top-right",
    className:
      "top-0 right-0 size-5 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    label: "Resize crop from top right corner",
  },
  {
    direction: "bottom-right",
    className:
      "right-0 bottom-0 size-5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    label: "Resize crop from bottom right corner",
  },
  {
    direction: "bottom-left",
    className:
      "bottom-0 left-0 size-5 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    label: "Resize crop from bottom left corner",
  },
];

function FreeCropResizeHandles({
  cropSize,
  maxCropSize,
  frameColors,
  onResize,
}: {
  cropSize: Size;
  maxCropSize: Size;
  frameColors: CropFrameColors;
  onResize: (size: Size) => void;
}) {
  const dragStart = useRef<{
    direction: ResizeDirection;
    point: { x: number; y: number };
    size: Size;
  } | null>(null);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    direction: ResizeDirection,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      direction,
      point: { x: event.clientX, y: event.clientY },
      size: cropSize,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    if (!start) return;

    const deltaX = event.clientX - start.point.x;
    const deltaY = event.clientY - start.point.y;
    const widthDelta = start.direction.includes("right")
      ? deltaX * 2
      : start.direction.includes("left")
        ? -deltaX * 2
        : 0;
    const heightDelta = start.direction.includes("bottom")
      ? deltaY * 2
      : start.direction.includes("top")
        ? -deltaY * 2
        : 0;

    onResize({
      width: Math.round(
        Math.min(
          maxCropSize.width,
          Math.max(MIN_FREE_CROP_SIZE, start.size.width + widthDelta),
        ),
      ),
      height: Math.round(
        Math.min(
          maxCropSize.height,
          Math.max(MIN_FREE_CROP_SIZE, start.size.height + heightDelta),
        ),
      ),
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    dragStart.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 border"
      style={{
        width: cropSize.width,
        height: cropSize.height,
        borderColor: frameColors.frame,
        boxShadow: `0 0 0 1px ${frameColors.outline}`,
      }}
    >
      {RESIZE_TARGETS.map(({ direction, className, label }) => (
        <button
          key={direction}
          type="button"
          aria-label={label}
          className={`pointer-events-auto absolute focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
          onPointerDown={(event) => handlePointerDown(event, direction)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        />
      ))}
    </div>
  );
}

function formatDimensions(width: number, height: number) {
  return `${width.toLocaleString()} x ${height.toLocaleString()}`;
}

function CropInspector({
  asset,
  croppedAreaPixels,
  aspect,
  frameColors,
  onOutputDimensionChange,
}: {
  asset: ImageAsset;
  croppedAreaPixels: Area | null;
  aspect: number;
  frameColors: CropFrameColors;
  onOutputDimensionChange: (dimension: CropDimension, value: number) => void;
}) {
  const originalWidth = asset.originalWidth ?? asset.width;
  const originalHeight = asset.originalHeight ?? asset.height;
  const outputWidth = Math.round(croppedAreaPixels?.width ?? originalWidth);
  const outputHeight = Math.round(croppedAreaPixels?.height ?? originalHeight);
  const aspectLabel =
    ASPECT_RATIOS.find((ratio) => ratio.value === aspect)?.label ?? "Custom";

  const handleIntegerInput = (event: React.FormEvent<HTMLInputElement>) => {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  };

  return (
    <section aria-label="Crop details">
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-xs font-medium text-muted-foreground">
            Original
          </dt>
          <dd className="font-mono text-sm text-foreground/90 tabular-nums">
            {formatDimensions(originalWidth, originalHeight)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-xs font-medium text-muted-foreground">Output</dt>
          <dd className="flex items-center gap-1.5 font-mono text-sm text-foreground/90 tabular-nums">
            <input
              key={`width-${outputWidth}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={outputWidth}
              aria-label="Output width in pixels"
              className="h-6 w-[6ch] rounded-sm border-0 bg-transparent px-0 text-right outline-none hover:bg-muted/60 focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              onInput={handleIntegerInput}
              onKeyDown={handleInputKeyDown}
              onBlur={(event) =>
                onOutputDimensionChange(
                  "width",
                  Number(event.currentTarget.value),
                )
              }
            />
            <span className="text-muted-foreground">x</span>
            <input
              key={`height-${outputHeight}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={outputHeight}
              aria-label="Output height in pixels"
              className="h-6 w-[6ch] rounded-sm border-0 bg-transparent px-0 text-right outline-none hover:bg-muted/60 focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
              onInput={handleIntegerInput}
              onKeyDown={handleInputKeyDown}
              onBlur={(event) =>
                onOutputDimensionChange(
                  "height",
                  Number(event.currentTarget.value),
                )
              }
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-xs font-medium text-muted-foreground">Aspect</dt>
          <dd className="text-sm text-foreground/90">{aspectLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-xs font-medium text-muted-foreground">Frame</dt>
          <dd className="flex items-center gap-1.5 text-sm text-foreground/90">
            <span
              aria-hidden="true"
              className="size-3 rounded-full border border-black/20 shadow-sm dark:border-white/20"
              style={{ backgroundColor: frameColors.frame }}
            />
            {frameColors.label}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ImageAssetViewer({
  asset: selectedAsset,
  open,
  onOpenChange,
}: {
  asset?: ImageAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const retainedAssetRef = useRef(selectedAsset);
  useEffect(() => {
    if (selectedAsset) retainedAssetRef.current = selectedAsset;
  }, [selectedAsset]);

  const asset = selectedAsset ?? retainedAssetRef.current;
  const shouldReduceMotion = useReducedMotion();
  const title = asset?.title || asset?.sourceLabel || "Image preview";

  const originalAspect = asset
    ? (asset.originalWidth ?? asset.width) /
      (asset.originalHeight ?? asset.height)
    : 4 / 3;

  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(
    null,
  );
  const [freeCropSize, setFreeCropSize] = useState<Size | null>(null);
  const [cropperCropSize, setCropperCropSize] = useState<Size | null>(null);
  const [cropperContainerSize, setCropperContainerSize] = useState<Size | null>(
    null,
  );
  const cropperContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setCropMode(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCroppedPreviewUrl(null);
      setFreeCropSize(null);
      setCropperCropSize(null);
    }
  }, [open]);

  useEffect(() => {
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppedPreviewUrl(null);
    setFreeCropSize(null);
    setCropperCropSize(null);
  }, [asset?.id]);

  useEffect(() => {
    const container = cropperContainerRef.current;
    if (!cropMode || !container) return;

    const updateSize = () => {
      setCropperContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [cropMode]);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const resolvedAspect = aspect === 0 ? originalAspect : aspect;

  const handleCropSizeChange = useCallback(
    (size: Size) => {
      setCropperCropSize(size);
      if (aspect === 0) {
        setFreeCropSize((currentSize) => currentSize ?? size);
      }
    },
    [aspect],
  );

  const handleAspectChange = useCallback(
    (nextAspect: number) => {
      setAspect(nextAspect);
      setFreeCropSize(nextAspect === 0 ? cropperCropSize : null);
    },
    [cropperCropSize],
  );

  const handleFreeCropResize = useCallback((size: Size) => {
    setFreeCropSize(size);
  }, []);

  const handleOutputDimensionChange = useCallback(
    (dimension: CropDimension, value: number) => {
      if (!asset || !Number.isFinite(value) || value < 1) return;

      const currentWidth =
        croppedAreaPixels?.width ?? asset.originalWidth ?? asset.width;
      const currentHeight =
        croppedAreaPixels?.height ?? asset.originalHeight ?? asset.height;
      const outputAspect = aspect === 0 ? currentWidth / currentHeight : aspect;
      const targetWidth = dimension === "width" ? value : value * outputAspect;
      const targetHeight =
        dimension === "height" ? value : value / outputAspect;

      if (aspect === 0 && freeCropSize && cropperContainerSize) {
        const maxWidth = Math.max(
          MIN_FREE_CROP_SIZE,
          cropperContainerSize.width - 12,
        );
        const maxHeight = Math.max(
          MIN_FREE_CROP_SIZE,
          cropperContainerSize.height - 12,
        );
        setFreeCropSize({
          width: Math.round(
            Math.min(
              maxWidth,
              Math.max(
                MIN_FREE_CROP_SIZE,
                freeCropSize.width * (targetWidth / currentWidth),
              ),
            ),
          ),
          height: Math.round(
            Math.min(
              maxHeight,
              Math.max(
                MIN_FREE_CROP_SIZE,
                freeCropSize.height * (targetHeight / currentHeight),
              ),
            ),
          ),
        });
        return;
      }

      setZoom((currentZoom) =>
        Math.min(3, Math.max(1, currentZoom * (currentWidth / targetWidth))),
      );
    },
    [asset, aspect, croppedAreaPixels, cropperContainerSize, freeCropSize],
  );

  const handleStartCrop = useCallback(() => {
    setCropMode(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(0);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setCropperCropSize(null);
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setCropperCropSize(null);
  }, []);

  const handleApplyCrop = useCallback(async () => {
    if (!asset || !croppedAreaPixels) return;
    try {
      const response = await fetch(asset.originalUrl ?? asset.url);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(croppedAreaPixels.width);
      canvas.height = Math.round(croppedAreaPixels.height);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        bitmap,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      bitmap.close();
      setCroppedPreviewUrl(canvas.toDataURL("image/webp", 0.92));
      setCropMode(false);
    } catch {
      setCropMode(false);
    }
  }, [asset, croppedAreaPixels]);

  const handleResetCrop = useCallback(() => {
    setCroppedPreviewUrl(null);
  }, []);

  const displayUrl = croppedPreviewUrl ?? asset?.url;
  const cropFrameColors = getCropFrameColors(asset?.dominantColors);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/20 duration-150"
        className="top-1/2 h-[min(90vh,58rem)] w-[min(94vw,80rem)] max-w-none -translate-y-1/2 transition-none data-ending-style:scale-100 data-ending-style:opacity-100 data-starting-style:scale-100 data-starting-style:opacity-100 sm:h-[min(88vh,56rem)]"
      >
        <DialogBody className="grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-visible rounded-md bg-background p-0 text-foreground lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Larger preview and details for the selected image asset.
          </DialogDescription>

          <div className="flex min-h-0 flex-col rounded-t-md bg-muted/35 lg:order-1 lg:rounded-l-md lg:rounded-tr-none">
            {cropMode && asset ? (
              <div className="min-h-0 flex-1 p-3 sm:p-5">
                <div ref={cropperContainerRef} className="relative size-full">
                  <Cropper
                    image={asset.originalUrl ?? asset.url}
                    crop={crop}
                    zoom={zoom}
                    aspect={resolvedAspect}
                    cropSize={
                      aspect === 0 ? (freeCropSize ?? undefined) : undefined
                    }
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={handleCropComplete}
                    onCropSizeChange={handleCropSizeChange}
                    classes={{ cropAreaClassName: cropFrameColors.className }}
                    disableAutomaticStylesInjection
                    showGrid
                  />
                  {aspect === 0 && freeCropSize && cropperContainerSize ? (
                    <FreeCropResizeHandles
                      cropSize={freeCropSize}
                      frameColors={cropFrameColors}
                      maxCropSize={{
                        width: Math.max(
                          MIN_FREE_CROP_SIZE,
                          cropperContainerSize.width - 12,
                        ),
                        height: Math.max(
                          MIN_FREE_CROP_SIZE,
                          cropperContainerSize.height - 12,
                        ),
                      }}
                      onResize={handleFreeCropResize}
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
                {displayUrl ? (
                  <motion.img
                    src={displayUrl}
                    alt={asset?.alt ?? ""}
                    width={asset?.width}
                    height={asset?.height}
                    draggable={false}
                    layoutId={
                      asset && !shouldReduceMotion && !croppedPreviewUrl
                        ? getImageViewerLayoutId(asset.id)
                        : undefined
                    }
                    transition={IMAGE_VIEWER_TRANSITION}
                    className="relative z-10 max-h-full max-w-full rounded-[6px] object-contain shadow-sm"
                    style={{ borderRadius: 6 }}
                  />
                ) : null}
              </div>
            )}
            {cropMode && asset ? (
              <CropToolbar
                aspect={aspect}
                zoom={zoom}
                onAspectChange={handleAspectChange}
                onZoomChange={setZoom}
              />
            ) : null}
          </div>

          <aside className="flex min-h-0 flex-col rounded-b-md border-t bg-background lg:order-2 lg:rounded-r-md lg:rounded-bl-none lg:border-t-0 lg:border-l">
            <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
              <span className="truncate text-sm font-medium">{title}</span>
              <DialogClose render={<Button variant="ghost" size="icon-sm" />}>
                <XIcon />
                <span className="sr-only">Close</span>
              </DialogClose>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {asset?.sourceUrl ? (
                  <div className="mb-4 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <ExternalLinkIcon className="size-3 shrink-0" />
                    <a
                      href={asset.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate transition-colors hover:text-foreground"
                    >
                      {asset.sourceLabel ?? "Source"}
                    </a>
                  </div>
                ) : null}

                {cropMode && asset ? (
                  <CropInspector
                    asset={asset}
                    croppedAreaPixels={croppedAreaPixels}
                    aspect={aspect}
                    frameColors={cropFrameColors}
                    onOutputDimensionChange={handleOutputDimensionChange}
                  />
                ) : asset ? (
                  <ImageMetadata asset={asset} />
                ) : null}
              </div>
              {cropMode ? (
                <div className="flex shrink-0 justify-end gap-2 p-3">
                  <Button variant="ghost" size="sm" onClick={handleCancelCrop}>
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={handleApplyCrop}>
                    <CheckIcon className="size-3.5" />
                    Apply
                  </Button>
                </div>
              ) : asset ? (
                <div className="flex shrink-0 items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            href={asset.url}
                            download={asset.title || "image-asset"}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "icon-sm",
                            })}
                          >
                            <DownloadIcon />
                            <span className="sr-only">Download</span>
                          </a>
                        }
                      />
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            href={asset.sourceUrl ?? asset.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({
                              variant: "ghost",
                              size: "icon-sm",
                            })}
                          >
                            <ExternalLinkIcon />
                            <span className="sr-only">Open</span>
                          </a>
                        }
                      />
                      <TooltipContent>Open</TooltipContent>
                    </Tooltip>
                  </div>
                  {croppedPreviewUrl ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleResetCrop}
                    >
                      <RotateCcwIcon className="size-3.5" />
                      Reset crop
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleStartCrop}
                    >
                      <CropIcon className="size-3.5" />
                      Crop
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </aside>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
