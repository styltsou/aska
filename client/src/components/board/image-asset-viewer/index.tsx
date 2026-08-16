import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PipetteIcon,
  XIcon,
} from "lucide-react";
import type { ImageAsset } from "@/types/asset";
import {
  type SyntheticEvent,
  type Ref,
  type MouseEvent,
  type PointerEvent,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import Cropper, { type Area, type Size } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { ImageColorPalette, ImageMetadataDetails } from "./image-metadata";
import { CropToolbar } from "./crop-toolbar";
import { apiPost } from "@/lib/api";
import { fetchAssetImageBlob } from "@/api/collection/fetchers";
import { collectionQueryKeys } from "@/api/collection/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { copyImageToClipboard } from "@/lib/clipboard";
import { GLASS_FRAME_CLASS, GLASS_SURFACE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import {
  getImageViewerLayoutId,
  IMAGE_VIEWER_TRANSITION,
} from "@/components/board/image-viewer-transition";

const MIN_FREE_CROP_SIZE = 80;
const COLOR_PREVIEW_GAP = 14;
const COLOR_PREVIEW_INSET = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const FLOATING_ISLAND_SURFACE_CLASS = cn(
  "relative z-10 rounded-md",
  GLASS_SURFACE_CLASS,
);

const COLOR_PICKER_SURFACE_CLASS = cn(
  "flex items-center gap-2 rounded-md border border-border/80 p-1.5",
  GLASS_FRAME_CLASS,
);

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
};

function getSourceLabel(asset: ImageAsset): string | undefined {
  if (!asset.sourceUrl) return undefined;
  if (asset.sourceLabel) return asset.sourceLabel;

  try {
    return new URL(asset.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return asset.sourceUrl;
  }
}

async function makeCroppedPreview(url: string, crop: Area): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load image preview");
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create image preview");
  context.drawImage(
    bitmap,
    Math.round(crop.x),
    Math.round(crop.y),
    Math.round(crop.width),
    Math.round(crop.height),
    0,
    0,
    canvas.width,
    canvas.height,
  );
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.9);
}

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

function ProgressiveViewerImage({
  displayUrl,
  originalUrl,
  alt,
  aspectRatio,
  layoutId,
  onLayoutAnimationStart,
  onLayoutAnimationComplete,
  imageRef,
  pickMode,
  onPick,
  loadSamplingCanvas,
}: {
  displayUrl: string;
  originalUrl?: string;
  alt: string;
  aspectRatio: number;
  layoutId?: string;
  onLayoutAnimationStart?: () => void;
  onLayoutAnimationComplete?: () => void;
  imageRef?: Ref<HTMLImageElement>;
  pickMode?: boolean;
  onPick?: (hex: string) => void;
  loadSamplingCanvas?: () => Promise<HTMLCanvasElement | null>;
}) {
  const [shouldLoadOriginal, setShouldLoadOriginal] = useState(false);
  const [isOriginalReady, setIsOriginalReady] = useState(false);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    hex: string;
  } | null>(null);
  const samplerRef = useRef<HTMLCanvasElement | null>(null);
  const samplerContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const colorPreviewRef = useRef<HTMLDivElement>(null);
  const colorPreviewSwatchRef = useRef<HTMLSpanElement>(null);
  const colorPreviewHexRef = useRef<HTMLParagraphElement>(null);
  const previewIsVisibleRef = useRef(false);
  const pendingSampleRef = useRef<{
    image: HTMLElement;
    clientX: number;
    clientY: number;
  } | null>(null);
  const lastPointerRef = useRef<{
    image: HTMLElement;
    clientX: number;
    clientY: number;
  } | null>(null);
  const samplingFrameRef = useRef<number | null>(null);
  const pickModeRef = useRef(pickMode);
  const hasSeparateOriginal =
    Boolean(originalUrl) && originalUrl !== displayUrl;

  pickModeRef.current = pickMode;

  useEffect(() => {
    if (!hasSeparateOriginal) return;

    const frame = requestAnimationFrame(() => setShouldLoadOriginal(true));
    return () => cancelAnimationFrame(frame);
  }, [hasSeparateOriginal]);

  const handleOriginalLoad = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const image = event.currentTarget;
      void image
        .decode()
        .catch(() => undefined)
        .finally(() => setIsOriginalReady(true));
    },
    [],
  );

  const samplePixel = useCallback(
    (image: HTMLElement, clientX: number, clientY: number) => {
      const canvas = samplerRef.current;
      const context = samplerContextRef.current;
      if (!canvas || !context) return null;
      const rect = image.getBoundingClientRect();
      const x = Math.min(
        canvas.width - 1,
        Math.max(
          0,
          Math.round(((clientX - rect.left) / rect.width) * canvas.width),
        ),
      );
      const y = Math.min(
        canvas.height - 1,
        Math.max(
          0,
          Math.round(((clientY - rect.top) / rect.height) * canvas.height),
        ),
      );
      const pixel = context.getImageData(x, y, 1, 1).data;
      return `#${[pixel[0], pixel[1], pixel[2]]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    samplerRef.current = null;
    samplerContextRef.current = null;

    void loadSamplingCanvas?.().then((canvas) => {
      if (cancelled || !canvas) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      samplerRef.current = canvas;
      samplerContextRef.current = context;

      const pointer = lastPointerRef.current;
      if (!pickModeRef.current || !pointer) return;
      const hex = samplePixel(pointer.image, pointer.clientX, pointer.clientY);
      if (!hex) return;
      const rect = pointer.image.getBoundingClientRect();
      previewIsVisibleRef.current = true;
      setHover({
        x: pointer.clientX - rect.left,
        y: pointer.clientY - rect.top,
        hex,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [loadSamplingCanvas, samplePixel]);

  useEffect(() => {
    setHover(null);
    previewIsVisibleRef.current = false;
    pendingSampleRef.current = null;
    lastPointerRef.current = null;
    if (samplingFrameRef.current !== null) {
      cancelAnimationFrame(samplingFrameRef.current);
      samplingFrameRef.current = null;
    }
  }, [pickMode]);

  const updatePreviewPosition = useCallback(
    (image: HTMLElement, clientX: number, clientY: number) => {
      const rect = image.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const preview = colorPreviewRef.current;
      if (preview) {
        const previewRect = preview.getBoundingClientRect();
        const maxLeft = Math.max(0, rect.width - previewRect.width);
        const horizontalInset = Math.min(COLOR_PREVIEW_INSET, maxLeft / 2);
        const left = clamp(
          x - previewRect.width / 2,
          horizontalInset,
          maxLeft - horizontalInset,
        );
        const maxTop = Math.max(0, rect.height - previewRect.height);
        const verticalInset = Math.min(COLOR_PREVIEW_INSET, maxTop / 2);
        const preferredTop = y - previewRect.height - COLOR_PREVIEW_GAP;
        const top = clamp(
          preferredTop >= verticalInset ? preferredTop : y + COLOR_PREVIEW_GAP,
          verticalInset,
          maxTop - verticalInset,
        );

        preview.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      }
      return { x, y };
    },
    [],
  );

  useLayoutEffect(() => {
    const pointer = lastPointerRef.current;
    if (!hover || !pointer) return;
    updatePreviewPosition(pointer.image, pointer.clientX, pointer.clientY);
  }, [hover, updatePreviewPosition]);

  const updatePreviewColor = useCallback((hex: string) => {
    if (colorPreviewSwatchRef.current) {
      colorPreviewSwatchRef.current.style.backgroundColor = hex;
    }
    if (colorPreviewHexRef.current) {
      colorPreviewHexRef.current.textContent = hex;
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const image = event.currentTarget;
      lastPointerRef.current = {
        image,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (!pickMode || !samplerRef.current) return;
      const position = updatePreviewPosition(
        image,
        event.clientX,
        event.clientY,
      );

      if (!previewIsVisibleRef.current) {
        const hex = samplePixel(image, event.clientX, event.clientY);
        if (!hex) return;
        previewIsVisibleRef.current = true;
        setHover({ ...position, hex });
        return;
      }

      pendingSampleRef.current = {
        image,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      if (samplingFrameRef.current !== null) return;

      samplingFrameRef.current = requestAnimationFrame(() => {
        samplingFrameRef.current = null;
        const pendingSample = pendingSampleRef.current;
        if (!pendingSample) return;
        const hex = samplePixel(
          pendingSample.image,
          pendingSample.clientX,
          pendingSample.clientY,
        );
        if (hex) updatePreviewColor(hex);
      });
    },
    [pickMode, samplePixel, updatePreviewColor, updatePreviewPosition],
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!pickMode || !samplerRef.current) return;
      const image = event.currentTarget;
      const hex = samplePixel(image, event.clientX, event.clientY);
      if (hex) onPick?.(hex);
    },
    [pickMode, samplePixel, onPick],
  );

  const handlePointerLeave = useCallback(() => {
    previewIsVisibleRef.current = false;
    pendingSampleRef.current = null;
    lastPointerRef.current = null;
    if (samplingFrameRef.current !== null) {
      cancelAnimationFrame(samplingFrameRef.current);
      samplingFrameRef.current = null;
    }
    setHover(null);
  }, []);

  return (
    <motion.div
      layoutId={layoutId}
      transition={IMAGE_VIEWER_TRANSITION}
      onLayoutAnimationStart={onLayoutAnimationStart}
      onLayoutAnimationComplete={onLayoutAnimationComplete}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      className={cn(
        "relative overflow-hidden rounded-lg",
        pickMode && "cursor-crosshair",
      )}
      style={{
        width: `min(100cqw, calc(100cqh * ${aspectRatio}))`,
        height: `min(100cqh, calc(100cqw / ${aspectRatio}))`,
      }}
    >
      <img
        ref={imageRef}
        src={displayUrl}
        alt={alt}
        draggable={false}
        loading="eager"
        className="size-full rounded-[inherit] object-cover"
      />
      {hasSeparateOriginal && shouldLoadOriginal && originalUrl ? (
        <img
          src={originalUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading="eager"
          onLoad={handleOriginalLoad}
          className={cn(
            "absolute inset-0 size-full rounded-[inherit] object-cover transition-opacity duration-150 motion-reduce:transition-none",
            isOriginalReady ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
      {pickMode && hover ? (
        <div
          ref={colorPreviewRef}
          className="pointer-events-none absolute z-10"
          style={{
            left: 0,
            top: 0,
            transform: `translate3d(${hover.x}px, ${hover.y}px, 0)`,
          }}
        >
          <div className={COLOR_PICKER_SURFACE_CLASS}>
            <span
              ref={colorPreviewSwatchRef}
              className="size-9 shrink-0 rounded-[calc(var(--radius-md)-3px)] ring-1 ring-black/15 ring-inset"
              style={{ backgroundColor: hover.hex }}
            />
            <p
              ref={colorPreviewHexRef}
              className="min-w-0 pr-1 font-mono text-sm leading-5 font-semibold text-foreground uppercase"
            >
              {hover.hex}
            </p>
          </div>
        </div>
      ) : null}
    </motion.div>
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
  const shouldReduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [editedAsset, setEditedAsset] = useState<ImageAsset | null>(null);
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showChrome, setShowChrome] = useState(false);
  const [optimisticCropPreviewUrl, setOptimisticCropPreviewUrl] = useState<
    string | null
  >(null);
  useEffect(() => {
    if (selectedAsset) retainedAssetRef.current = selectedAsset;
  }, [selectedAsset]);

  useEffect(() => {
    if (!open) {
      setShowBackdrop(false);
      setShowChrome(false);
      return;
    }

    const frame = requestAnimationFrame(() => setShowBackdrop(true));
    const fallback = window.setTimeout(() => setShowChrome(true), 200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [open]);

  const asset = editedAsset ?? selectedAsset ?? retainedAssetRef.current;
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
  const [cropError, setCropError] = useState<string | null>(null);
  const [hasCopiedImage, setHasCopiedImage] = useState(false);
  const [hasCopiedColor, setHasCopiedColor] = useState(false);
  const [isEyeDropping, setIsEyeDropping] = useState(false);
  const cropperContainerRef = useRef<HTMLDivElement>(null);
  const viewerImageRef = useRef<HTMLImageElement>(null);
  const copiedImageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const copiedColorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    setEditedAsset(null);
    setOptimisticCropPreviewUrl(null);
    if (!open) {
      setCropMode(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setFreeCropSize(null);
      setAspectCropSize(null);
      setCropperCropSize(null);
      setMediaLoaded(false);
      setIsEyeDropping(false);
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
    setCropError(null);
    setHasCopiedImage(false);
    setHasCopiedColor(false);
    setIsEyeDropping(false);
  }, [asset?.id]);

  useEffect(() => {
    return () => {
      if (copiedImageTimeoutRef.current) {
        clearTimeout(copiedImageTimeoutRef.current);
      }
      if (copiedColorTimeoutRef.current) {
        clearTimeout(copiedColorTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isEyeDropping) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();
      setIsEyeDropping(false);
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isEyeDropping]);

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
    setCropError(null);
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
    setCropError(null);
  }, []);

  const handleApplyCrop = useCallback(async () => {
    if (!asset || !croppedAreaPixels) return;
    setIsSavingCrop(true);
    setCropError(null);
    const cropArea = {
      x: Math.round(croppedAreaPixels.x),
      y: Math.round(croppedAreaPixels.y),
      width: Math.round(croppedAreaPixels.width),
      height: Math.round(croppedAreaPixels.height),
    };
    const request = apiPost<CropResponse>(
      `/api/v1/workspace/${workspaceSlug}/images/${encodeURIComponent(asset.id)}/crop`,
      { crop: cropArea },
    );
    try {
      const preview = await makeCroppedPreview(
        asset.originalUrl ?? asset.url,
        cropArea,
      ).catch(() => null);
      if (preview) setOptimisticCropPreviewUrl(preview);
      setCropMode(false);

      const response = await request;
      const nextAsset = {
        ...asset,
        ...response.image,
        dominantColors: [],
        localPreviewUrl: undefined,
      };
      setEditedAsset(nextAsset);
      setOptimisticCropPreviewUrl(null);
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
    } catch (error) {
      setOptimisticCropPreviewUrl(null);
      setCropMode(true);
      setCropError(
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

  const handleCopyImage = useCallback(async () => {
    if (!asset) return;

    try {
      await copyImageToClipboard(async () => {
        if (!asset.uploadStatus) {
          return fetchAssetImageBlob(workspaceSlug, asset.id);
        }

        const response = await fetch(
          asset.localPreviewUrl ?? asset.originalUrl ?? asset.url,
        );
        if (!response.ok) throw new Error("Unable to copy image.");
        return response.blob();
      });
      setHasCopiedImage(true);
      if (copiedImageTimeoutRef.current) {
        clearTimeout(copiedImageTimeoutRef.current);
      }
      copiedImageTimeoutRef.current = setTimeout(() => {
        setHasCopiedImage(false);
      }, 1500);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to copy image.",
      );
    }
  }, [asset, workspaceSlug]);

  const flashCopiedColor = useCallback(() => {
    setHasCopiedColor(true);
    if (copiedColorTimeoutRef.current) {
      clearTimeout(copiedColorTimeoutRef.current);
    }
    copiedColorTimeoutRef.current = setTimeout(() => {
      setHasCopiedColor(false);
    }, 1500);
  }, []);

  const copyColor = useCallback(
    async (hex: string) => {
      try {
        await navigator.clipboard.writeText(hex.toUpperCase());
        flashCopiedColor();
      } catch {
        toast.error("Unable to copy color.");
      }
    },
    [flashCopiedColor],
  );

  const loadSamplingCanvas =
    useCallback(async (): Promise<HTMLCanvasElement | null> => {
      try {
        const url = asset?.uploadStatus
          ? (asset.localPreviewUrl ?? asset.originalUrl ?? asset.url)
          : undefined;
        let blob: Blob;
        if (url) {
          const response = await fetch(url);
          if (!response.ok) throw new Error("Unable to load image.");
          blob = await response.blob();
        } else if (asset) {
          blob = await fetchAssetImageBlob(workspaceSlug, asset.id);
        } else {
          return null;
        }
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          bitmap.close();
          return null;
        }
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        return canvas;
      } catch {
        toast.error("Unable to read image colors.");
        return null;
      }
    }, [asset, workspaceSlug]);

  const handlePickColorResult = useCallback(
    (hex: string) => {
      setIsEyeDropping(false);
      void copyColor(hex);
    },
    [copyColor],
  );

  const handlePickColor = useCallback(() => {
    setIsEyeDropping((prev) => !prev);
  }, []);

  const displayUrl = optimisticCropPreviewUrl ?? asset?.url;
  const viewerImageUrl =
    optimisticCropPreviewUrl ?? asset?.originalUrl ?? asset?.url;
  const viewerAspectRatio = asset
    ? (asset.originalWidth ?? asset.width) /
      (asset.originalHeight ?? asset.height)
    : 1;
  const blurPlaceholder = asset?.uploadStatus ? undefined : asset?.blurDataURL;
  const sourceLabel = asset ? getSourceLabel(asset) : undefined;
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
        initialFocus={false}
        overlayClassName="bg-transparent duration-0"
        className="top-1/2 h-[100svh] w-screen max-w-none -translate-y-1/2 rounded-none bg-transparent shadow-none ring-0 duration-100 data-ending-style:scale-100! data-ending-style:opacity-100! data-starting-style:scale-100! data-starting-style:opacity-100!"
      >
        <DialogBody className="relative isolate h-full min-h-0 w-full overflow-hidden rounded-none border-0 bg-transparent p-0 text-foreground">
          {displayUrl ? (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit] bg-neutral-950 opacity-0 transition-opacity duration-150 ease-out will-change-opacity motion-reduce:transition-none",
                showBackdrop && "opacity-100",
              )}
              aria-hidden="true"
            >
              <img
                src={displayUrl}
                alt=""
                className="absolute top-1/2 left-1/2 h-1/2 w-1/2 -translate-x-1/2 -translate-y-1/2 scale-[2.2] transform-gpu object-cover blur-2xl saturate-150 [@media(prefers-reduced-transparency:reduce)]:hidden"
              />
              <div className="absolute inset-0 bg-neutral-950/45" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/25" />
            </div>
          ) : null}
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Larger preview and details for the selected image asset.
          </DialogDescription>

          <div
            className={cn(
              "pointer-events-none absolute inset-x-3 top-3 z-30 flex justify-end opacity-0 transition-opacity duration-100 ease-out motion-reduce:transition-none sm:inset-x-4 sm:top-4",
              showChrome && "opacity-100",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto flex min-w-0 items-center gap-1 [&_[data-slot=button]]:duration-75",
                !cropMode && asset?.sourceUrl ? "lg:w-80" : "ml-auto",
              )}
            >
              {!cropMode && asset?.sourceUrl ? (
                <a
                  href={asset.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={asset.sourceUrl}
                  className="hidden min-w-0 lg:block lg:flex-1"
                >
                  <div
                    className={cn(
                      FLOATING_ISLAND_SURFACE_CLASS,
                      "flex h-[34px] min-w-0 items-center gap-1.5 px-2.5 text-sm font-medium text-primary transition-colors duration-75 hover:bg-muted hover:text-primary",
                    )}
                  >
                    <ExternalLinkIcon className="size-4 shrink-0" />
                    <span className="truncate">{sourceLabel}</span>
                  </div>
                </a>
              ) : null}

              <div className={FLOATING_ISLAND_SURFACE_CLASS}>
                <ButtonGroup>
                  {cropMode ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelCrop}
                        disabled={isSavingCrop}
                      >
                        Discard
                      </Button>
                      <ButtonGroupSeparator className="bg-border/70" />
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleApplyCrop}
                        disabled={isSavingCrop}
                      >
                        <CheckIcon className="size-3.5" />
                        {isSavingCrop ? "Saving…" : "Apply crop"}
                      </Button>
                    </>
                  ) : asset ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleCopyImage}
                            />
                          }
                        >
                          {hasCopiedImage ? <CheckIcon /> : <CopyIcon />}
                          <span className="sr-only">
                            {hasCopiedImage ? "Copied image" : "Copy image"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {hasCopiedImage ? "Copied image" : "Copy image"}
                        </TooltipContent>
                      </Tooltip>
                      <ButtonGroupSeparator className="bg-border/70" />
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleDownload}
                            />
                          }
                        >
                          <DownloadIcon />
                          <span className="sr-only">Download</span>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>
                      <ButtonGroupSeparator className="bg-border/70" />
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handlePickColor}
                              className={cn(
                                "transition-all duration-100 hover:bg-foreground/5",
                                isEyeDropping && "bg-foreground/8",
                              )}
                              aria-pressed={isEyeDropping}
                            />
                          }
                        >
                          {hasCopiedColor ? <CheckIcon /> : <PipetteIcon />}
                          <span className="sr-only">
                            {isEyeDropping
                              ? "Click the image to copy a color. Press Escape to cancel."
                              : hasCopiedColor
                                ? "Copied color"
                                : "Pick color"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isEyeDropping
                            ? "Click the image to copy · Escape to cancel"
                            : hasCopiedColor
                              ? "Copied color"
                              : "Pick color"}
                        </TooltipContent>
                      </Tooltip>
                      <ButtonGroupSeparator className="bg-border/70" />
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={handleStartCrop}
                            />
                          }
                        >
                          Edit
                        </TooltipTrigger>
                        <TooltipContent>Edit image</TooltipContent>
                      </Tooltip>
                    </>
                  ) : null}
                </ButtonGroup>
              </div>

              <div className={FLOATING_ISLAND_SURFACE_CLASS}>
                <ButtonGroup>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <DialogClose
                          render={<Button variant="ghost" size="icon" />}
                        />
                      }
                    >
                      <XIcon />
                      <span className="sr-only">Close</span>
                    </TooltipTrigger>
                    <TooltipContent>Close</TooltipContent>
                  </Tooltip>
                </ButtonGroup>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex h-full min-h-0 flex-col">
            {cropMode && asset ? (
              <div className="relative z-10 min-h-0 flex-1 p-6 sm:p-8 lg:pr-[23rem]">
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
              <div className="[container-type:size] flex min-h-0 flex-1 items-center justify-center p-6 sm:p-8 lg:pr-[23rem]">
                {open && displayUrl ? (
                  <ProgressiveViewerImage
                    key={viewerImageUrl}
                    displayUrl={displayUrl}
                    originalUrl={viewerImageUrl}
                    alt={asset?.alt ?? ""}
                    aspectRatio={viewerAspectRatio}
                    layoutId={
                      asset && !shouldReduceMotion
                        ? getImageViewerLayoutId(asset.id)
                        : undefined
                    }
                    onLayoutAnimationStart={() => setShowChrome(false)}
                    onLayoutAnimationComplete={() => setShowChrome(true)}
                    imageRef={viewerImageRef}
                    pickMode={isEyeDropping}
                    onPick={handlePickColorResult}
                    loadSamplingCanvas={loadSamplingCanvas}
                  />
                ) : null}
              </div>
            )}
          </div>

          <aside
            className={cn(
              "pointer-events-none absolute right-3 z-20 flex max-h-[calc(100%-6rem)] w-[min(20rem,calc(100%-1.5rem))] min-h-0 flex-col gap-1 opacity-0 transition-opacity duration-100 ease-out motion-reduce:transition-none sm:right-4 sm:w-80",
              cropMode ? "bottom-14" : "bottom-3 sm:bottom-4",
              showChrome && "pointer-events-auto opacity-100",
            )}
          >
            {!cropMode && asset ? (
              <div
                className={cn(FLOATING_ISLAND_SURFACE_CLASS, "shrink-0 p-3")}
              >
                <p className="truncate text-sm leading-5 font-medium">
                  {title}
                </p>
              </div>
            ) : null}
            <div
              className={cn(
                FLOATING_ISLAND_SURFACE_CLASS,
                "min-h-0 flex-1 overflow-y-auto p-4",
              )}
            >
              {!cropMode && asset?.sourceUrl ? (
                <div className="mb-4 flex items-center gap-1 text-xs font-medium text-muted-foreground lg:hidden">
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
                <div className="space-y-5">
                  <CropToolbar
                    aspect={aspect}
                    zoom={zoom}
                    onAspectChange={handleAspectChange}
                    onZoomChange={setZoom}
                  />
                  <CropInspector
                    asset={asset}
                    croppedAreaPixels={croppedAreaPixels}
                    onOutputDimensionChange={handleOutputDimensionChange}
                  />
                </div>
              ) : asset ? (
                <ImageMetadataDetails asset={asset} />
              ) : null}
              {cropError ? (
                <p className="mt-4 text-xs text-destructive" role="alert">
                  {cropError}
                </p>
              ) : null}
            </div>
            {!cropMode && asset ? (
              <div
                className={cn(FLOATING_ISLAND_SURFACE_CLASS, "shrink-0 p-3")}
              >
                <ImageColorPalette asset={asset} />
              </div>
            ) : null}
          </aside>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
