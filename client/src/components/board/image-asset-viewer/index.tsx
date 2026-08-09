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
  DownloadIcon,
  ExternalLinkIcon,
  XIcon,
} from "lucide-react";
import type { ImageAsset } from "@/types/asset";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import Cropper, { type Area, type Size } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import {
  getImageViewerLayoutId,
  IMAGE_VIEWER_TRANSITION,
} from "@/components/board/image-viewer-transition";
import { ImageMetadata } from "./image-metadata";
import { CropToolbar } from "./crop-toolbar";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { apiPost } from "@/lib/api";
import { collectionQueryKeys } from "@/api/collection/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const MIN_FREE_CROP_SIZE = 80;

type CropFrameColors = {
  frame: string;
  className: string;
};

type CropDimension = "width" | "height";

type CropResponse = {
  image: Pick<
    ImageAsset,
    | "id"
    | "type"
    | "url"
    | "originalUrl"
    | "originalWidth"
    | "originalHeight"
    | "width"
    | "height"
    | "title"
    | "alt"
  >;
  operationId: number;
  undoableUntil: string;
};

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
      className: "aska-crop-area aska-crop-area--theme",
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
        className: "aska-crop-area aska-crop-area--dark",
      }
    : {
        frame: "rgb(255 255 255)",
        className: "aska-crop-area aska-crop-area--light",
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
  aspect,
  frameColors,
  onResize,
}: {
  cropSize: Size;
  maxCropSize: Size;
  aspect?: number;
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

    if (aspect) {
      const relativeWidth = (start.size.width + widthDelta) / start.size.width;
      const relativeHeight =
        (start.size.height + heightDelta) / start.size.height;
      const dominant =
        Math.abs(relativeWidth - 1) >= Math.abs(relativeHeight - 1)
          ? relativeWidth
          : relativeHeight;
      const scale = Math.min(
        Math.min(
          maxCropSize.width / start.size.width,
          maxCropSize.height / start.size.height,
        ),
        Math.max(
          Math.max(
            MIN_FREE_CROP_SIZE / start.size.width,
            MIN_FREE_CROP_SIZE / start.size.height,
          ),
          dominant,
        ),
      );

      onResize({
        width: Math.round(start.size.width * scale),
        height: Math.round(start.size.height * scale),
      });
      return;
    }

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
      }}
    >
      {RESIZE_TARGETS.filter(
        ({ direction }) => !aspect || direction.includes("-"),
      ).map(({ direction, className, label }) => (
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
  return `${width} x ${height}`;
}

function fitCropSize(size: Size, aspect: number, maxSize: Size): Size {
  let width = Math.max(MIN_FREE_CROP_SIZE, Math.min(size.width, maxSize.width));
  let height = Math.max(
    MIN_FREE_CROP_SIZE,
    Math.min(size.height, maxSize.height),
  );

  if (width / aspect <= height) {
    height = width / aspect;
  } else {
    width = height * aspect;
  }

  if (width > maxSize.width) {
    width = maxSize.width;
    height = width / aspect;
  }
  if (height > maxSize.height) {
    height = maxSize.height;
    width = height * aspect;
  }

  return { width: Math.round(width), height: Math.round(height) };
}

function fitCropMaxSize(size: Size, aspect: number): Size {
  return {
    width: Math.max(
      MIN_FREE_CROP_SIZE,
      Math.min(size.width, size.height * aspect),
    ),
    height: Math.max(
      MIN_FREE_CROP_SIZE,
      Math.min(size.height, size.width / aspect),
    ),
  };
}

function CropInspector({
  asset,
  croppedAreaPixels,
  onOutputDimensionChange,
}: {
  asset: ImageAsset;
  croppedAreaPixels: Area | null;
  onOutputDimensionChange: (dimension: CropDimension, value: number) => void;
}) {
  const originalWidth = asset.originalWidth ?? asset.width;
  const originalHeight = asset.originalHeight ?? asset.height;
  const outputWidth = Math.round(croppedAreaPixels?.width ?? originalWidth);
  const outputHeight = Math.round(croppedAreaPixels?.height ?? originalHeight);

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
      </dl>
    </section>
  );
}

export function ImageAssetViewer({
  asset: selectedAsset,
  open,
  onOpenChange,
  workspaceSlug,
}: {
  asset?: ImageAsset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
}) {
  const retainedAssetRef = useRef(selectedAsset);
  const queryClient = useQueryClient();
  const [editedAsset, setEditedAsset] = useState<ImageAsset | null>(null);
  useEffect(() => {
    if (selectedAsset) retainedAssetRef.current = selectedAsset;
  }, [selectedAsset]);

  const asset = editedAsset ?? selectedAsset ?? retainedAssetRef.current;
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
  const [freeCropSize, setFreeCropSize] = useState<Size | null>(null);
  const [aspectCropSize, setAspectCropSize] = useState<Size | null>(null);
  const [cropperCropSize, setCropperCropSize] = useState<Size | null>(null);
  const [cropperContainerSize, setCropperContainerSize] = useState<Size | null>(
    null,
  );
  const [mediaSize, setMediaSize] = useState<Size | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const cropperContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditedAsset(null);
    if (!open) {
      setCropMode(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setFreeCropSize(null);
      setAspectCropSize(null);
      setCropperCropSize(null);
      setMediaLoaded(false);
    }
  }, [open]);

  useEffect(() => {
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
    setMediaSize(null);
    setMediaLoaded(false);
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

  useEffect(() => {
    if (!cropMode || aspect !== 0 || !mediaSize || freeCropSize) {
      return;
    }
    if (mediaSize.width < 1 || mediaSize.height < 1) {
      return;
    }

    setFreeCropSize({
      width: Math.round(mediaSize.width),
      height: Math.round(mediaSize.height),
    });
  }, [aspect, cropMode, freeCropSize, mediaSize]);

  useEffect(() => {
    if (!mediaSize || mediaSize.width < 1 || mediaSize.height < 1) return;

    const maxWidth = mediaSize.width * zoom;
    const maxHeight = mediaSize.height * zoom;

    if (aspect === 0) {
      if (!freeCropSize) return;

      const width = Math.round(Math.min(freeCropSize.width, maxWidth));
      const height = Math.round(Math.min(freeCropSize.height, maxHeight));

      if (width !== freeCropSize.width || height !== freeCropSize.height) {
        setFreeCropSize({ width, height });
      }
      return;
    }

    if (!aspectCropSize) return;

    const scale = Math.min(
      1,
      maxWidth / aspectCropSize.width,
      maxHeight / aspectCropSize.height,
    );
    if (scale < 1) {
      setAspectCropSize({
        width: Math.round(aspectCropSize.width * scale),
        height: Math.round(aspectCropSize.height * scale),
      });
    }
  }, [aspect, aspectCropSize, freeCropSize, mediaSize, zoom]);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const resolvedAspect = aspect === 0 ? originalAspect : aspect;

  const cropMaxSize = useMemo(() => {
    if (!cropperContainerSize) return null;

    const bounds = mediaSize
      ? {
          width: mediaSize.width * zoom,
          height: mediaSize.height * zoom,
        }
      : cropperContainerSize;

    return {
      width: Math.max(
        MIN_FREE_CROP_SIZE,
        Math.min(bounds.width, cropperContainerSize.width),
      ),
      height: Math.max(
        MIN_FREE_CROP_SIZE,
        Math.min(bounds.height, cropperContainerSize.height),
      ),
    };
  }, [cropperContainerSize, mediaSize, zoom]);

  const handleCropSizeChange = useCallback(
    (size: Size) => {
      if (size.width < 1 || size.height < 1) return;

      if (aspect === 0) {
        setFreeCropSize((currentSize) => currentSize ?? size);
      } else {
        setCropperCropSize(size);
        setAspectCropSize((currentSize) => currentSize ?? size);
      }
    },
    [aspect],
  );

  const handleAspectChange = useCallback(
    (nextAspect: number) => {
      setAspect(nextAspect);

      if (nextAspect === 0) {
        setAspectCropSize(null);
        setFreeCropSize(
          (currentSize) => currentSize ?? aspectCropSize ?? cropperCropSize,
        );
        return;
      }

      setFreeCropSize(null);
      const base = freeCropSize ?? aspectCropSize ?? cropperCropSize;
      if (base && cropMaxSize) {
        setAspectCropSize(fitCropSize(base, nextAspect, cropMaxSize));
      }
    },
    [aspectCropSize, cropMaxSize, cropperCropSize, freeCropSize],
  );

  const handleCropBoxResize = useCallback(
    (size: Size) => {
      if (aspect === 0) {
        setFreeCropSize(size);
      } else {
        setAspectCropSize(size);
      }
    },
    [aspect],
  );

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

      if (aspect === 0 && freeCropSize && cropMaxSize) {
        const maxWidth = cropMaxSize.width;
        const maxHeight = cropMaxSize.height;
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
    [asset, aspect, croppedAreaPixels, cropMaxSize, freeCropSize],
  );

  const handleStartCrop = useCallback(() => {
    setCropMode(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(0);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
    setMediaLoaded(false);
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
  }, []);

  const handleApplyCrop = useCallback(async () => {
    if (!asset || !croppedAreaPixels) return;
    setIsSavingCrop(true);
    try {
      const response = await apiPost<CropResponse>(
        `/api/v1/workspace/${workspaceSlug}/images/${encodeURIComponent(asset.id)}/crop`,
        {
          crop: {
            x: Math.round(croppedAreaPixels.x),
            y: Math.round(croppedAreaPixels.y),
            width: Math.round(croppedAreaPixels.width),
            height: Math.round(croppedAreaPixels.height),
          },
        },
      );
      const nextAsset = {
        ...asset,
        ...response.image,
        localPreviewUrl: undefined,
      };
      setEditedAsset(nextAsset);
      setCropMode(false);
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["collectionContents", workspaceSlug],
          exact: false,
        }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.inbox(workspaceSlug),
          exact: false,
        }),
      ]);
      toast("Crop applied", {
        duration: Math.max(
          1_000,
          new Date(response.undoableUntil).getTime() - Date.now(),
        ),
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              const undone = await apiPost<{ image: CropResponse["image"] }>(
                `/api/v1/workspace/${workspaceSlug}/crop-operations/${response.operationId}/undo`,
              );
              setEditedAsset((current) =>
                current ? { ...current, ...undone.image } : current,
              );
              void queryClient.invalidateQueries({
                queryKey: ["collectionContents", workspaceSlug],
                exact: false,
              });
              void queryClient.invalidateQueries({
                queryKey: collectionQueryKeys.inbox(workspaceSlug),
                exact: false,
              });
              toast("Crop undone", {
                action: {
                  label: "Redo",
                  onClick: async () => {
                    try {
                      const redone = await apiPost<{
                        image: CropResponse["image"];
                      }>(
                        `/api/v1/workspace/${workspaceSlug}/crop-operations/${response.operationId}/redo`,
                      );
                      setEditedAsset((current) =>
                        current ? { ...current, ...redone.image } : current,
                      );
                      void queryClient.invalidateQueries({
                        queryKey: ["collectionContents", workspaceSlug],
                        exact: false,
                      });
                      void queryClient.invalidateQueries({
                        queryKey: collectionQueryKeys.inbox(workspaceSlug),
                        exact: false,
                      });
                      toast("Crop restored");
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Could not redo crop",
                      );
                    }
                  },
                },
              });
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not undo crop",
              );
            }
          },
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not apply crop",
      );
    } finally {
      setIsSavingCrop(false);
    }
  }, [asset, croppedAreaPixels, queryClient, workspaceSlug]);

  const handleDownload = useCallback(() => {
    if (!asset) return;
    const link = document.createElement("a");
    link.href = `/api/v1/workspace/${workspaceSlug}/assets/${encodeURIComponent(
      asset.id,
    )}/download`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [asset, workspaceSlug]);

  const displayUrl = asset?.url;
  const blurPlaceholder = asset?.uploadStatus ? undefined : asset?.blurDataURL;
  const cropFrameColors = getCropFrameColors(asset?.dominantColors);
  const cropBoxSize = aspect === 0 ? freeCropSize : aspectCropSize;
  const cropBoxMaxSize =
    aspect === 0 || !cropMaxSize
      ? cropMaxSize
      : fitCropMaxSize(cropMaxSize, aspect);

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
                  {!mediaLoaded && blurPlaceholder ? (
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={blurPlaceholder}
                        alt=""
                        aria-hidden="true"
                        className="size-full object-contain blur-[5px] brightness-90 saturate-75"
                      />
                    </div>
                  ) : null}
                  <Cropper
                    image={asset.originalUrl ?? asset.url}
                    crop={crop}
                    zoom={zoom}
                    aspect={resolvedAspect}
                    cropSize={cropBoxSize ?? undefined}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={handleCropComplete}
                    onCropSizeChange={handleCropSizeChange}
                    onMediaLoaded={() => setMediaLoaded(true)}
                    setMediaSize={setMediaSize}
                    classes={{ cropAreaClassName: cropFrameColors.className }}
                    disableAutomaticStylesInjection
                    showGrid
                  />
                  {cropBoxSize && cropBoxMaxSize ? (
                    <FreeCropResizeHandles
                      cropSize={cropBoxSize}
                      aspect={aspect === 0 ? undefined : aspect}
                      frameColors={cropFrameColors}
                      maxCropSize={cropBoxMaxSize}
                      onResize={handleCropBoxResize}
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-5">
                {displayUrl ? (
                  <ProgressiveImage
                    src={displayUrl}
                    fallbackSrc={asset?.localPreviewUrl}
                    blurDataURL={blurPlaceholder}
                    alt={asset?.alt ?? ""}
                    draggable={false}
                    layoutId={
                      asset && !shouldReduceMotion
                        ? getImageViewerLayoutId(asset.id)
                        : undefined
                    }
                    transition={IMAGE_VIEWER_TRANSITION}
                    loading="eager"
                    className="relative z-10 max-h-full max-w-full rounded-[6px] object-contain"
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
                    onOutputDimensionChange={handleOutputDimensionChange}
                  />
                ) : asset ? (
                  <ImageMetadata asset={asset} />
                ) : null}
              </div>
              {cropMode ? (
                <div className="flex shrink-0 justify-end gap-2 p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelCrop}
                    disabled={isSavingCrop}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApplyCrop}
                    disabled={isSavingCrop}
                  >
                    <CheckIcon className="size-3.5" />
                    {isSavingCrop ? "Saving…" : "Apply"}
                  </Button>
                </div>
              ) : asset ? (
                <div className="flex shrink-0 items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleDownload}
                          >
                            <DownloadIcon />
                            <span className="sr-only">Download</span>
                          </Button>
                        }
                      />
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <a
                            href={asset.originalUrl ?? asset.url}
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
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleStartCrop}
                  >
                    <CropIcon className="size-3.5" />
                    Crop
                  </Button>
                </div>
              ) : null}
            </div>
          </aside>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
