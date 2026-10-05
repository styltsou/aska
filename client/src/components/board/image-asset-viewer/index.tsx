import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AssetTimestampCard } from "@/components/board/asset-timestamp-card";
import { ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS } from "@/components/board/asset-viewer-control-styles";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LocateFixedIcon,
  Maximize2Icon,
  Minimize2Icon,
  PanelRightIcon,
  PencilIcon,
  PipetteIcon,
  RotateCcwIcon,
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
import Cropper, { type Area, type MediaSize, type Size } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { ImageColorPalette, ImageMetadataDetails } from "./image-metadata";
import { CropToolbar } from "./crop-toolbar";
import { getImageNavigation } from "./image-navigation";
import { apiPost } from "@/lib/api";
import { fetchAssetImageBlob } from "@/api/collection/fetchers";
import { collectionQueryKeys } from "@/api/collection/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { copyImageToClipboard } from "@/lib/clipboard";
import { GLASS_FRAME_CLASS, GLASS_ISLAND_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useImageNoteEditor } from "./use-image-note-editor";
import type { AssetLocation } from "@/api/collection";
import { useWorkspacePeek } from "@/components/app-shell/workspace-peek";
import { useIsMobile } from "@/hooks/use-mobile";
import { matchesKeybinding, PEEK_ASSET_SHORTCUT } from "@/lib/keybindings";
import { useAssetFullscreenMorph } from "@/components/board/use-asset-fullscreen-morph";

const MIN_FREE_CROP_SIZE = 80;
const COLOR_PREVIEW_GAP = 14;
const COLOR_PREVIEW_INSET = 8;
const MAX_VIEWER_IMAGE_WIDTH = 1920;
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function swapSize(size: Size): Size {
  return { width: size.height, height: size.width };
}

function fitSizeWithinBounds(size: Size, maxSize: Size): Size {
  const scale = Math.min(
    1,
    maxSize.width / size.width,
    maxSize.height / size.height,
  );
  return {
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
  };
}

const VIEWER_CONTROL_FRAME_CLASS = "relative rounded-lg p-[3px]";

const VIEWER_HEADER_ICON_BUTTON_CLASS = `rounded-[calc(var(--radius-md)-1px)] ${ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS}`;

const COLOR_PICKER_SURFACE_CLASS = cn(
  "flex items-center gap-2 rounded-md border border-border/80 p-1.5",
  GLASS_FRAME_CLASS,
);

const VIEWER_CANVAS_CLASS =
  "min-h-0 flex-1 px-5 py-14 pr-5 sm:px-8 sm:py-16 sm:pr-8 lg:pr-[27rem]";

const VIEWER_IMAGE_CANVAS_CLASS =
  "min-h-0 flex-1 py-14 pl-16 pr-16 sm:py-16 sm:pl-20 sm:pr-20";

const CROP_AREA_BASE_CLASS =
  "![border-width:1px] !shadow-none before:content-[''] before:!border-[color-mix(in_srgb,currentcolor_72%,transparent)] before:![border-width:1px] before:transition-opacity before:duration-50 before:ease-[ease] after:content-[''] after:!border-[color-mix(in_srgb,currentcolor_72%,transparent)] after:![border-width:1px] after:transition-opacity after:duration-50 after:ease-[ease] motion-reduce:before:transition-none motion-reduce:after:transition-none";

const CROP_FRAME_BASE_CLASS =
  "before:content-[''] before:absolute before:pointer-events-none before:!border-[color-mix(in_srgb,currentcolor_72%,transparent)] before:border-solid before:transition-opacity before:duration-50 before:ease-[ease] before:[inset:0_33.33%] before:![border-width:0_1px] after:content-[''] after:absolute after:pointer-events-none after:!border-[color-mix(in_srgb,currentcolor_72%,transparent)] after:border-solid after:transition-opacity after:duration-50 after:ease-[ease] after:[inset:33.33%_0] after:![border-width:1px_0] motion-reduce:before:transition-none motion-reduce:after:transition-none";

type CropFrameColors = {
  frame: string;
  className: string;
};

type CropTransform = {
  rotation: number;
  flipX: boolean;
  flipY: boolean;
};

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

async function makeCroppedPreview(
  url: string,
  crop: Area,
  transform: CropTransform,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load image preview");
  const bitmap = await createImageBitmap(await response.blob());
  const isQuarterTurn = transform.rotation % 180 !== 0;
  const transformedCanvas = document.createElement("canvas");
  transformedCanvas.width = isQuarterTurn ? bitmap.height : bitmap.width;
  transformedCanvas.height = isQuarterTurn ? bitmap.width : bitmap.height;
  const transformedContext = transformedCanvas.getContext("2d");
  if (!transformedContext) throw new Error("Could not transform image preview");
  transformedContext.translate(
    transformedCanvas.width / 2,
    transformedCanvas.height / 2,
  );
  transformedContext.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  transformedContext.rotate((transform.rotation * Math.PI) / 180);
  transformedContext.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(crop.width);
  canvas.height = Math.round(crop.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create image preview");
  context.drawImage(
    transformedCanvas,
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
      className: cn(
        CROP_AREA_BASE_CLASS,
        "![border-color:color-mix(in_srgb,var(--sidebar-foreground)_90%,transparent)] ![color:color-mix(in_srgb,var(--sidebar-foreground)_90%,transparent)]",
      ),
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
        className: cn(
          CROP_AREA_BASE_CLASS,
          "![border-color:rgb(0_0_0_/_0.9)] ![color:rgb(0_0_0_/_0.9)]",
        ),
      }
    : {
        frame: "rgb(255 255 255)",
        className: cn(
          CROP_AREA_BASE_CLASS,
          "![border-color:rgb(255_255_255_/_0.9)] ![color:rgb(255_255_255_/_0.9)]",
        ),
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

const CORNER_HANDLE_CLASS: Partial<Record<ResizeDirection, string>> = {
  "top-left": "top-[calc(50%-2px)] left-[calc(50%-2px)] border-t-4 border-l-4",
  "top-right":
    "top-[calc(50%-2px)] right-[calc(50%-2px)] border-t-4 border-r-4",
  "bottom-right":
    "right-[calc(50%-2px)] bottom-[calc(50%-2px)] border-r-4 border-b-4",
  "bottom-left":
    "bottom-[calc(50%-2px)] left-[calc(50%-2px)] border-b-4 border-l-4",
};

function FreeCropResizeHandles({
  cropSize,
  maxCropSize,
  aspect,
  frameColors,
  showGrid,
  onInteractionStart,
  onInteractionEnd,
  onResize,
}: {
  cropSize: Size;
  maxCropSize: Size;
  aspect?: number;
  frameColors: CropFrameColors;
  showGrid: boolean;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
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
    onInteractionStart();
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
    onInteractionEnd();
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 border",
        CROP_FRAME_BASE_CLASS,
        !showGrid && "before:opacity-0 after:opacity-0",
      )}
      style={{
        width: cropSize.width,
        height: cropSize.height,
        borderColor: frameColors.frame,
        color: frameColors.frame,
      }}
    >
      {RESIZE_TARGETS.filter(
        ({ direction }) => !aspect || direction.includes("-"),
      ).map(({ direction, className, label }) => (
        <button
          key={direction}
          type="button"
          aria-label={label}
          className={cn(
            "pointer-events-auto absolute focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            className,
          )}
          onPointerDown={(event) => handlePointerDown(event, direction)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {CORNER_HANDLE_CLASS[direction] ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute z-10 size-10 border-current",
                CORNER_HANDLE_CLASS[direction],
              )}
            />
          ) : null}
        </button>
      ))}
    </div>
  );
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

function fitCropSizeFromLargestDimension(
  size: Size,
  aspect: number,
  maxSize: Size,
): Size {
  const largestDimension = Math.max(size.width, size.height);
  const targetSize =
    aspect >= 1
      ? {
          width: largestDimension,
          height: largestDimension / aspect,
        }
      : {
          width: largestDimension * aspect,
          height: largestDimension,
        };

  return fitCropSize(targetSize, aspect, maxSize);
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

function ProgressiveViewerImage({
  displayUrl,
  originalUrl,
  alt,
  aspectRatio,
  imageRef,
  pickMode,
  onPick,
  loadSamplingCanvas,
  animateLayout = false,
  layoutDependency,
  layoutTransition,
}: {
  displayUrl: string;
  originalUrl?: string;
  alt: string;
  aspectRatio: number;
  imageRef?: Ref<HTMLImageElement>;
  pickMode?: boolean;
  onPick?: (hex: string) => void;
  loadSamplingCanvas?: () => Promise<HTMLCanvasElement | null>;
  animateLayout?: boolean;
  layoutDependency?: string;
  layoutTransition?: Transition;
}) {
  const maxViewerImageHeight = MAX_VIEWER_IMAGE_WIDTH / aspectRatio;
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
      data-asset-modal-hero
      layout={animateLayout}
      layoutDependency={layoutDependency}
      transition={{ layout: layoutTransition }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      className={cn(
        "relative isolate overflow-hidden rounded-lg",
        pickMode && "cursor-crosshair",
      )}
      style={{
        width: `min(100cqw, calc(100cqh * ${aspectRatio}), ${MAX_VIEWER_IMAGE_WIDTH}px)`,
        height: `min(100cqh, calc(100cqw / ${aspectRatio}), ${maxViewerImageHeight}px)`,
        clipPath: "inset(0 round var(--radius-lg))",
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

function ImageViewerActions({
  asset,
  cropMode,
  isSavingCrop,
  isEyeDropping,
  hasCopiedColor,
  hasCopiedImage,
  onStartCrop,
  onPickColor,
  onCopyImage,
  onDownload,
}: {
  asset: ImageAsset;
  cropMode: boolean;
  isSavingCrop: boolean;
  isEyeDropping: boolean;
  hasCopiedColor: boolean;
  hasCopiedImage: boolean;
  onStartCrop: () => void;
  onPickColor: () => void;
  onCopyImage: () => void;
  onDownload: () => void;
}) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              onClick={onStartCrop}
              disabled={cropMode || isSavingCrop}
            />
          }
        >
          <PencilIcon />
          Edit
        </TooltipTrigger>
        <TooltipContent>Edit image</TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onPickColor}
                className={VIEWER_HEADER_ICON_BUTTON_CLASS}
                aria-pressed={isEyeDropping}
                disabled={cropMode}
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
            {cropMode
              ? "Finish editing to pick a color"
              : isEyeDropping
                ? "Click the image to copy · Escape to cancel"
                : hasCopiedColor
                  ? "Copied color"
                  : "Pick color"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onCopyImage}
                className={VIEWER_HEADER_ICON_BUTTON_CLASS}
              />
            }
          >
            <CopyFeedbackIcon copied={hasCopiedImage} />
            <span className="sr-only">
              {hasCopiedImage ? "Copied image" : "Copy image"}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {hasCopiedImage ? "Copied image" : "Copy image"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onDownload}
                className={VIEWER_HEADER_ICON_BUTTON_CLASS}
              />
            }
          >
            <DownloadIcon />
            <span className="sr-only">Download</span>
          </TooltipTrigger>
          <TooltipContent>Download</TooltipContent>
        </Tooltip>
        <AssetTimestampCard
          createdAt={asset.createdAt}
          updatedAt={asset.updatedAt}
          label="Image details"
          triggerClassName={VIEWER_HEADER_ICON_BUTTON_CLASS}
        />
      </div>
    </>
  );
}

function ImageViewerModeButton({
  expanded,
  onToggleExpanded,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const label = expanded ? "Exit full screen" : "Full screen";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={VIEWER_HEADER_ICON_BUTTON_CLASS}
            aria-label={label}
            onClick={onToggleExpanded}
          />
        }
      >
        {expanded ? <Minimize2Icon /> : <Maximize2Icon />}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ImageViewerModalHeaderControls({
  title,
  onClose,
  onExpand,
  onPeek,
  onShowInBoard,
}: {
  title: string;
  onClose: () => void;
  onExpand: () => void;
  onPeek?: () => void;
  onShowInBoard?: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={VIEWER_HEADER_ICON_BUTTON_CLASS}
              aria-label="Close image"
              onClick={onClose}
            />
          }
        >
          <XIcon />
          <span className="sr-only">Close image</span>
        </TooltipTrigger>
        <TooltipContent>Close image</TooltipContent>
      </Tooltip>
      {onPeek ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={VIEWER_HEADER_ICON_BUTTON_CLASS}
                aria-label="Peek image"
                onClick={onPeek}
              />
            }
          >
            <PanelRightIcon />
            <span className="sr-only">Peek image</span>
          </TooltipTrigger>
          <TooltipContent>Peek image</TooltipContent>
        </Tooltip>
      ) : null}
      {onShowInBoard ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={VIEWER_HEADER_ICON_BUTTON_CLASS}
                aria-label="Show in board"
                onClick={onShowInBoard}
              />
            }
          >
            <LocateFixedIcon />
            <span className="sr-only">Show in board</span>
          </TooltipTrigger>
          <TooltipContent>Show in board</TooltipContent>
        </Tooltip>
      ) : null}
      <ImageViewerModeButton expanded={false} onToggleExpanded={onExpand} />
      <span className="max-w-[min(32rem,calc(100vw-14rem))] min-w-0 truncate px-1 text-sm font-medium text-foreground">
        {title}
      </span>
    </div>
  );
}

function ImageNavigationControls({
  currentAssetIndex,
  assetCount,
  previousAsset,
  nextAsset,
  expanded,
  onAssetChange,
}: {
  currentAssetIndex: number;
  assetCount: number;
  previousAsset?: ImageAsset;
  nextAsset?: ImageAsset;
  expanded: boolean;
  onAssetChange: (asset: ImageAsset, view: "modal" | "full") => void;
}) {
  if (currentAssetIndex < 0 || assetCount < 2) return null;

  const navigationInset = expanded
    ? "right-[27rem] sm:max-lg:right-[21rem] max-sm:right-0"
    : "right-0";
  const buttonClassName =
    "size-10 rounded-lg !border-transparent !bg-neutral-950/55 !text-white shadow-lg backdrop-blur-sm transition-transform hover:!bg-neutral-950/80 active:not-disabled:scale-[0.97]";

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 flex items-center justify-between px-5 sm:px-8",
          navigationInset,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className={cn("pointer-events-auto", buttonClassName)}
          aria-label="Previous image"
          disabled={!previousAsset}
          onClick={() =>
            previousAsset &&
            onAssetChange(previousAsset, expanded ? "full" : "modal")
          }
        >
          <ChevronLeftIcon className="size-6 stroke-[2.25]" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className={cn("pointer-events-auto", buttonClassName)}
          aria-label="Next image"
          disabled={!nextAsset}
          onClick={() =>
            nextAsset && onAssetChange(nextAsset, expanded ? "full" : "modal")
          }
        >
          <ChevronRightIcon className="size-6 stroke-[2.25]" />
        </Button>
      </div>
      <div
        className={cn(
          "pointer-events-none absolute bottom-5 left-0 flex justify-center px-5 sm:px-8",
          navigationInset,
        )}
      >
        <span className="rounded-lg bg-neutral-950/65 px-3 py-1.5 text-xs font-medium text-white tabular-nums shadow-lg backdrop-blur-sm">
          {currentAssetIndex + 1} / {assetCount}
        </span>
      </div>
    </div>
  );
}

export function ImageAssetViewer({
  assetModalId,
  sharedEntry = false,
  sharedMorphing = false,
  asset: selectedAsset,
  assets = [],
  open,
  onOpenChange,
  onOpenChangeComplete,
  loading = false,
  onBack,
  onDismissAll,
  onAssetChange,
  onShowInBoard,
  view,
  onViewChange,
  workspaceSlug,
  location,
}: {
  assetModalId?: string;
  sharedEntry?: boolean;
  sharedMorphing?: boolean;
  asset?: ImageAsset;
  assets?: ImageAsset[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
  loading?: boolean;
  onBack?: () => void;
  onDismissAll?: () => void;
  onAssetChange?: (asset: ImageAsset, view: "modal" | "full") => void;
  onShowInBoard?: () => void;
  view?: "modal" | "full";
  onViewChange?: (view: "modal" | "full") => void;
  workspaceSlug: string;
  location?: AssetLocation;
}) {
  const retainedAssetRef = useRef(selectedAsset);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { target: peekTarget, peekImage } = useWorkspacePeek();
  const [editedAsset, setEditedAsset] = useState<ImageAsset | null>(null);
  const [optimisticCropPreviewUrl, setOptimisticCropPreviewUrl] = useState<
    string | null
  >(null);
  useEffect(() => {
    if (selectedAsset) retainedAssetRef.current = selectedAsset;
  }, [selectedAsset]);

  useEffect(() => {
    setEditedAsset(null);
    setOptimisticCropPreviewUrl(null);
  }, [selectedAsset?.id]);

  const applicableEditedAsset =
    editedAsset &&
    (!selectedAsset || editedAsset.id === selectedAsset.id) &&
    !loading
      ? editedAsset
      : null;
  const asset =
    applicableEditedAsset ??
    selectedAsset ??
    (loading ? undefined : retainedAssetRef.current);
  const title = asset?.title || asset?.sourceLabel || "Image preview";
  const {
    currentIndex: currentAssetIndex,
    previousAsset,
    nextAsset,
  } = getImageNavigation(assets, asset?.id);
  const hasImageNavigation = currentAssetIndex >= 0 && assets.length > 1;

  useEffect(() => {
    const adjacentUrls = [previousAsset?.url, nextAsset?.url].filter(
      (url): url is string => Boolean(url),
    );
    for (const url of adjacentUrls) {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
    }
  }, [nextAsset?.url, previousAsset?.url]);

  const originalAspect = asset
    ? (asset.originalWidth ?? asset.width) /
      (asset.originalHeight ?? asset.height)
    : 4 / 3;

  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(0);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [freeCropSize, setFreeCropSize] = useState<Size | null>(null);
  const [aspectCropSize, setAspectCropSize] = useState<Size | null>(null);
  const [cropperCropSize, setCropperCropSize] = useState<Size | null>(null);
  const [cropperContainerSize, setCropperContainerSize] = useState<Size | null>(
    null,
  );
  const [mediaSize, setMediaSize] = useState<Size | null>(null);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [isCropInteracting, setIsCropInteracting] = useState(false);
  const [hasCropChanges, setHasCropChanges] = useState(false);
  const [hasManualCropResize, setHasManualCropResize] = useState(false);
  const [isSavingCrop, setIsSavingCrop] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);
  const [hasCopiedImage, setHasCopiedImage] = useState(false);
  const [hasCopiedColor, setHasCopiedColor] = useState(false);
  const [isEyeDropping, setIsEyeDropping] = useState(false);
  const {
    note: imageNote,
    onChange: handleImageNoteChange,
    flush: flushImageNote,
  } = useImageNoteEditor({ asset, workspaceSlug });
  const shouldReduceMotion = useReducedMotion();
  const [localExpanded, setLocalExpanded] = useState(true);
  const expanded = view ? view === "full" : localExpanded;
  const split = Boolean(peekTarget) && !isMobile;
  const workspace = expanded || split;
  const {
    panelRef: fullscreenPanelRef,
    captureCurrentRect: captureFullscreenPanel,
  } = useAssetFullscreenMorph(
    Boolean(assetModalId) && open && !isMobile && !split && !sharedMorphing,
    expanded,
  );
  const fullscreenTransitionDuration = assetModalId
    ? expanded
      ? "duration-[400ms]"
      : "duration-[350ms]"
    : "duration-[180ms]";
  const fullscreenLayoutTransition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : {
        duration: expanded ? 0.4 : 0.35,
        ease: [0.22, 1, 0.36, 1],
      };
  const presentation = split ? "split" : expanded ? "fullscreen" : "modal";
  const headerControlButtonClass = VIEWER_HEADER_ICON_BUTTON_CLASS;
  const toggleExpanded = useCallback(() => {
    captureFullscreenPanel();
    const nextView = expanded ? "modal" : "full";
    if (onViewChange) onViewChange(nextView);
    else setLocalExpanded((current) => !current);
  }, [captureFullscreenPanel, expanded, onViewChange]);
  const cropperContainerRef = useRef<HTMLDivElement>(null);
  const naturalMediaSizeRef = useRef<Size | null>(null);
  const measuredMediaSizeRef = useRef<Size | null>(null);
  const lastReportedCropSizeRef = useRef<(Size & { aspect: number }) | null>(
    null,
  );
  const imageNoteRef = useRef<HTMLTextAreaElement>(null);
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
      setRotation(0);
      setFlipX(false);
      setFlipY(false);
      setCroppedAreaPixels(null);
      setFreeCropSize(null);
      setAspectCropSize(null);
      setCropperCropSize(null);
      setMediaLoaded(false);
      setIsCropInteracting(false);
      setHasCropChanges(false);
      setHasManualCropResize(false);
      setIsEyeDropping(false);
    }
  }, [open]);

  useEffect(() => {
    naturalMediaSizeRef.current = null;
    measuredMediaSizeRef.current = null;
    lastReportedCropSizeRef.current = null;
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
    setMediaSize(null);
    setMediaLoaded(false);
    setCropError(null);
    setIsCropInteracting(false);
    setHasCropChanges(false);
    setHasManualCropResize(false);
    setHasCopiedImage(false);
    setHasCopiedColor(false);
    setIsEyeDropping(false);
  }, [asset?.id]);

  const commitMediaSize = useCallback((size: Size) => {
    if (size.width <= 0 || size.height <= 0) return;
    const current = measuredMediaSizeRef.current;
    if (current?.width === size.width && current.height === size.height) return;
    const next = { width: size.width, height: size.height };
    measuredMediaSizeRef.current = next;
    setMediaSize(next);
  }, []);

  const handleMediaLoaded = useCallback(
    (size: MediaSize) => {
      naturalMediaSizeRef.current = {
        width: size.naturalWidth,
        height: size.naturalHeight,
      };
      commitMediaSize(size);
      setMediaLoaded(true);
    },
    [commitMediaSize],
  );

  const handleAssetChange = useCallback(
    (nextAsset: ImageAsset, nextView: "modal" | "full") => {
      void flushImageNote().then(() => onAssetChange?.(nextAsset, nextView));
    },
    [flushImageNote, onAssetChange],
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean, details?: { reason?: string }) => {
      if (nextOpen) {
        onOpenChange(true);
        return;
      }
      void flushImageNote().then(() => {
        if (details?.reason === "outside-press" && onDismissAll) onDismissAll();
        else if (onBack) onBack();
        else onOpenChange(false);
      });
    },
    [flushImageNote, onBack, onDismissAll, onOpenChange],
  );

  const handlePeek = useCallback(() => {
    if (
      !asset ||
      !location ||
      asset.uploadStatus ||
      isMobile ||
      cropMode ||
      isSavingCrop
    )
      return;
    void (async () => {
      const draft = await flushImageNote();
      const opened = await peekImage(
        { ...asset, note: draft.trim() ? draft : null },
        location,
        { demoteMain: true },
      );
      if (opened) handleOpenChange(false);
    })();
  }, [
    asset,
    cropMode,
    flushImageNote,
    handleOpenChange,
    isMobile,
    isSavingCrop,
    location,
    peekImage,
  ]);

  const handleDismissAll = useCallback(() => {
    if (!onDismissAll) return;
    void flushImageNote().then(onDismissAll);
  }, [flushImageNote, onDismissAll]);

  const handleClose = useCallback(() => {
    if (onDismissAll) handleDismissAll();
    else handleOpenChange(false);
  }, [handleDismissAll, handleOpenChange, onDismissAll]);

  const handleShowInBoard = useCallback(() => {
    if (!onShowInBoard) return;
    void flushImageNote().then(onShowInBoard);
  }, [flushImageNote, onShowInBoard]);

  useEffect(() => {
    if (!open || !asset || !location || isMobile) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !matchesKeybinding(event, PEEK_ASSET_SHORTCUT)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handlePeek();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [asset, handlePeek, isMobile, location, open]);

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
      const width = container.clientWidth;
      const height = container.clientHeight;
      setCropperContainerSize({ width, height });

      const natural = naturalMediaSizeRef.current;
      if (!natural || natural.width <= 0 || natural.height <= 0) return;
      const bounds = container.getBoundingClientRect();
      const scale = Math.min(
        1,
        bounds.width / natural.width,
        bounds.height / natural.height,
      );
      commitMediaSize({
        width: natural.width * scale,
        height: natural.height * scale,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [commitMediaSize, cropMode]);

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

    const rotatedMediaWidth =
      (rotation % 180 !== 0 ? mediaSize.height : mediaSize.width) * zoom;
    const rotatedMediaHeight =
      (rotation % 180 !== 0 ? mediaSize.width : mediaSize.height) * zoom;
    const maxWidth = cropperContainerSize
      ? Math.min(rotatedMediaWidth, cropperContainerSize.width)
      : rotatedMediaWidth;
    const maxHeight = cropperContainerSize
      ? Math.min(rotatedMediaHeight, cropperContainerSize.height)
      : rotatedMediaHeight;

    if (aspect === 0) {
      // In automatic mode, Cropper owns the frame size. Only clamp a size the
      // user explicitly resized and that we pass back as a controlled prop.
      if (!freeCropSize || !hasManualCropResize) return;

      const { width, height } = fitSizeWithinBounds(freeCropSize, {
        width: maxWidth,
        height: maxHeight,
      });

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
  }, [
    aspect,
    aspectCropSize,
    cropperContainerSize,
    freeCropSize,
    hasManualCropResize,
    mediaSize,
    rotation,
    zoom,
  ]);

  const handleCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropChange = useCallback(
    (nextCrop: { x: number; y: number }) => {
      if (nextCrop.x === crop.x && nextCrop.y === crop.y) return;
      setCrop(nextCrop);
      setHasCropChanges(true);
    },
    [crop.x, crop.y],
  );

  const handleZoomChange = useCallback((nextZoom: number) => {
    setZoom(nextZoom);
    setHasCropChanges(true);
  }, []);

  const handleRotate = useCallback(
    (direction: "clockwise" | "counterclockwise") => {
      setFreeCropSize((size) => (size ? swapSize(size) : size));
      setAspectCropSize((size) => (size ? swapSize(size) : size));
      setCropperCropSize((size) => (size ? swapSize(size) : size));
      setRotation(
        (currentRotation) =>
          (currentRotation + (direction === "clockwise" ? 90 : -90) + 360) %
          360,
      );
      setHasCropChanges(true);
    },
    [],
  );

  const handleFlipHorizontal = useCallback(() => {
    setFlipX((currentFlip) => !currentFlip);
    setHasCropChanges(true);
  }, []);

  const handleFlipVertical = useCallback(() => {
    setFlipY((currentFlip) => !currentFlip);
    setHasCropChanges(true);
  }, []);

  const handleCropInteractionStart = useCallback(() => {
    setIsCropInteracting(true);
  }, []);

  const handleCropInteractionEnd = useCallback(() => {
    setIsCropInteracting(false);
  }, []);

  const isQuarterTurn = rotation % 180 !== 0;
  const resolvedAspect =
    aspect === 0
      ? isQuarterTurn
        ? 1 / originalAspect
        : originalAspect
      : isQuarterTurn
        ? 1 / aspect
        : aspect;

  const cropMaxSize = useMemo(() => {
    if (!cropperContainerSize) return null;

    const bounds = mediaSize
      ? {
          width: (isQuarterTurn ? mediaSize.height : mediaSize.width) * zoom,
          height: (isQuarterTurn ? mediaSize.width : mediaSize.height) * zoom,
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
  }, [cropperContainerSize, isQuarterTurn, mediaSize, zoom]);

  const handleCropSizeChange = useCallback(
    (size: Size) => {
      if (size.width < 1 || size.height < 1) return;
      const previous = lastReportedCropSizeRef.current;
      if (
        previous?.aspect === aspect &&
        previous.width === size.width &&
        previous.height === size.height
      ) {
        return;
      }
      lastReportedCropSizeRef.current = { ...size, aspect };

      if (aspect === 0) {
        if (!hasManualCropResize) setFreeCropSize(size);
      } else {
        setCropperCropSize(size);
        setAspectCropSize((currentSize) => currentSize ?? size);
      }
    },
    [aspect, hasManualCropResize],
  );

  const handleAspectChange = useCallback(
    (nextAspect: number) => {
      setHasCropChanges(true);
      setAspect(nextAspect);

      if (nextAspect === 0) {
        setAspectCropSize(null);
        setFreeCropSize((currentSize) => {
          if (currentSize) return currentSize;
          if (!hasManualCropResize) {
            return mediaSize
              ? {
                  width: Math.round(mediaSize.width),
                  height: Math.round(mediaSize.height),
                }
              : null;
          }
          return aspectCropSize ?? cropperCropSize;
        });
        return;
      }

      setFreeCropSize(null);
      const base = freeCropSize ?? aspectCropSize ?? cropperCropSize;
      if (base && cropMaxSize) {
        setAspectCropSize(
          fitCropSizeFromLargestDimension(
            base,
            isQuarterTurn ? 1 / nextAspect : nextAspect,
            cropMaxSize,
          ),
        );
      }
    },
    [
      aspectCropSize,
      cropMaxSize,
      cropperCropSize,
      freeCropSize,
      hasManualCropResize,
      isQuarterTurn,
      mediaSize,
    ],
  );

  const handleCropBoxResize = useCallback(
    (size: Size) => {
      setHasCropChanges(true);
      setHasManualCropResize(true);
      if (aspect === 0) {
        setFreeCropSize(size);
      } else {
        setAspectCropSize(size);
      }
    },
    [aspect],
  );

  const handleResetCrop = useCallback(() => {
    lastReportedCropSizeRef.current = null;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(0);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
    setCropError(null);
    setIsCropInteracting(false);
    setHasCropChanges(false);
    setHasManualCropResize(false);
  }, []);

  const handleStartCrop = useCallback(() => {
    naturalMediaSizeRef.current = null;
    measuredMediaSizeRef.current = null;
    lastReportedCropSizeRef.current = null;
    setCropMode(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(0);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
    setMediaSize(null);
    setMediaLoaded(false);
    setCropError(null);
    setIsCropInteracting(false);
    setHasCropChanges(false);
    setHasManualCropResize(false);
  }, []);

  const handleCancelCrop = useCallback(() => {
    setCropMode(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setCroppedAreaPixels(null);
    setFreeCropSize(null);
    setAspectCropSize(null);
    setCropperCropSize(null);
    setCropError(null);
    setIsCropInteracting(false);
    setHasCropChanges(false);
    setHasManualCropResize(false);
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
    const transform = { rotation, flipX, flipY };
    const request = apiPost<CropResponse>(
      `/api/v1/workspace/${workspaceSlug}/images/${encodeURIComponent(asset.id)}/crop`,
      { crop: cropArea, transform },
    );
    try {
      const preview = await makeCroppedPreview(
        asset.originalUrl ?? asset.url,
        cropArea,
        transform,
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
      setRotation(0);
      setFlipX(false);
      setFlipY(false);
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
  }, [
    asset,
    croppedAreaPixels,
    flipX,
    flipY,
    queryClient,
    rotation,
    workspaceSlug,
  ]);

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
  // Do not feed Cropper's auto-calculated free size back as a controlled prop.
  // Fullscreen subpixel measurements can otherwise bounce between the two.
  const controlledCropSize =
    aspect === 0 && !hasManualCropResize
      ? undefined
      : (cropBoxSize ?? undefined);
  const cropBoxMaxSize =
    aspect === 0 || !cropMaxSize
      ? cropMaxSize
      : fitCropMaxSize(cropMaxSize, isQuarterTurn ? 1 / aspect : aspect);
  const activeCropSize = cropBoxSize ?? cropperCropSize;
  const cropHighlightClip =
    activeCropSize && cropperContainerSize
      ? `inset(${Math.max(0, (cropperContainerSize.height - activeCropSize.height) / 2)}px ${Math.max(0, (cropperContainerSize.width - activeCropSize.width) / 2)}px)`
      : undefined;
  const cropTransform = `translate(${crop.x}px, ${crop.y}px) scale(${zoom}) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1}) rotate(${rotation}deg)`;
  const imageActionProps = asset
    ? {
        asset,
        cropMode,
        isSavingCrop,
        isEyeDropping,
        hasCopiedColor,
        hasCopiedImage,
        onStartCrop: handleStartCrop,
        onPickColor: handlePickColor,
        onCopyImage: handleCopyImage,
        onDownload: handleDownload,
      }
    : undefined;

  return (
    <Dialog
      open={open}
      modal={!split}
      onOpenChange={handleOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
    >
      <DialogContent
        ref={fullscreenPanelRef}
        data-workspace-asset-modal={assetModalId}
        data-canvas-shared-entry={sharedEntry || undefined}
        showCloseButton={false}
        data-command-palette-allowed="true"
        overlayClassName={cn(
          assetModalId && "workspace-asset-view-backdrop",
          sharedEntry && "canvas-shared-entry",
          split && "hidden",
          !split &&
            expanded &&
            "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 bg-background duration-150",
        )}
        className={cn(
          "top-1/2 flex min-h-0 -translate-y-1/2 flex-col overflow-hidden transition-[transform,opacity,top,width,height,max-width,border-radius,background-color,box-shadow] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none motion-reduce:transition-none",
          fullscreenTransitionDuration,
          workspace
            ? "h-[100svh] w-screen max-w-none rounded-none bg-transparent shadow-none ring-0 data-ending-style:scale-100 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-100 data-starting-style:opacity-100"
            : "h-[min(52rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[88rem] rounded-xl bg-popover/80 shadow-2xl ring-1 ring-foreground/10 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          split &&
            "left-0 z-50 w-[calc(100dvw-var(--workspace-peek-rail-width)-var(--workspace-peek-stage-gap)-var(--workspace-peek-stage-gap))] translate-x-0",
        )}
      >
        <DialogBody
          className={cn(
            "relative isolate flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden p-0 text-foreground transition-[border-color,border-radius,background-color] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            "rounded-none border-0 bg-transparent",
            loading && "bg-neutral-950",
          )}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Larger preview and details for the selected image asset.
          </DialogDescription>

          <div
            className={cn(
              "z-30 flex items-center gap-3",
              expanded
                ? "pointer-events-none absolute top-5 left-5"
                : "relative h-12 shrink-0 justify-between px-3",
            )}
          >
            {expanded ? (
              <div className="pointer-events-auto flex max-w-[calc(100vw-2.5rem)] items-center gap-1.5">
                <div
                  className={cn(VIEWER_CONTROL_FRAME_CLASS, GLASS_ISLAND_CLASS)}
                >
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={headerControlButtonClass}
                            aria-label="Close image"
                            onClick={handleClose}
                          />
                        }
                      >
                        <XIcon />
                        <span className="sr-only">Close image</span>
                      </TooltipTrigger>
                      <TooltipContent>Close image</TooltipContent>
                    </Tooltip>
                    {asset &&
                    location &&
                    !asset.uploadStatus &&
                    !isMobile &&
                    !cropMode &&
                    !isSavingCrop ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={headerControlButtonClass}
                              aria-label="Peek image"
                              onClick={handlePeek}
                            />
                          }
                        >
                          <PanelRightIcon />
                          <span className="sr-only">Peek image</span>
                        </TooltipTrigger>
                        <TooltipContent>Peek image</TooltipContent>
                      </Tooltip>
                    ) : null}
                    {onShowInBoard ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className={headerControlButtonClass}
                              aria-label="Show in board"
                              onClick={handleShowInBoard}
                            />
                          }
                        >
                          <LocateFixedIcon />
                          <span className="sr-only">Show in board</span>
                        </TooltipTrigger>
                        <TooltipContent>Show in board</TooltipContent>
                      </Tooltip>
                    ) : null}
                    <ImageViewerModeButton
                      expanded
                      onToggleExpanded={toggleExpanded}
                    />
                  </div>
                </div>
                <div
                  className={cn(
                    GLASS_ISLAND_CLASS,
                    "flex h-9 min-w-0 items-center rounded-lg px-3",
                  )}
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {title}
                  </span>
                </div>
              </div>
            ) : (
              <ImageViewerModalHeaderControls
                title={title}
                onClose={handleClose}
                onExpand={toggleExpanded}
                onPeek={
                  asset &&
                  location &&
                  !asset.uploadStatus &&
                  !isMobile &&
                  !cropMode &&
                  !isSavingCrop
                    ? handlePeek
                    : undefined
                }
                onShowInBoard={onShowInBoard ? handleShowInBoard : undefined}
              />
            )}
            {!expanded ? (
              <div className="flex min-w-0 items-center justify-end gap-2">
                {imageActionProps ? (
                  <ImageViewerActions {...imageActionProps} />
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "relative z-10 flex min-h-0 flex-1",
              expanded && "h-full",
              !expanded &&
                "overflow-hidden rounded-t-xl border-t border-border",
            )}
          >
            <div className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {displayUrl ? (
                <div
                  className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-neutral-950"
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
              {cropMode && asset ? (
                <div
                  className={cn(
                    "[container-type:size] relative z-10 flex items-center justify-center",
                    VIEWER_CANVAS_CLASS,
                    !expanded && "lg:pr-8",
                  )}
                >
                  <div
                    ref={cropperContainerRef}
                    className="relative mx-auto h-full w-full max-w-[1920px] overflow-visible"
                    style={{
                      width: `min(100cqw, calc(100cqh * ${originalAspect}), 1920px)`,
                      height: `min(100cqh, calc(100cqw / ${originalAspect}), ${1920 / originalAspect}px)`,
                    }}
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-lg">
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
                        rotation={rotation}
                        transform={cropTransform}
                        aspect={resolvedAspect}
                        cropSize={controlledCropSize}
                        onCropChange={handleCropChange}
                        onZoomChange={handleZoomChange}
                        onInteractionStart={handleCropInteractionStart}
                        onInteractionEnd={handleCropInteractionEnd}
                        onCropComplete={handleCropComplete}
                        onCropSizeChange={handleCropSizeChange}
                        onMediaLoaded={handleMediaLoaded}
                        classes={{
                          cropAreaClassName: cn(
                            cropFrameColors.className,
                            !isCropInteracting &&
                              "before:opacity-0 after:opacity-0",
                          ),
                        }}
                        style={{ mediaStyle: { filter: "brightness(0.48)" } }}
                        objectFit="contain"
                        disableAutomaticStylesInjection
                        showGrid={isCropInteracting}
                      />
                      {mediaSize && cropHighlightClip ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
                          style={{ clipPath: cropHighlightClip }}
                        >
                          <img
                            src={asset.originalUrl ?? asset.url}
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            className="absolute top-1/2 left-1/2 max-w-none"
                            style={{
                              width: mediaSize.width,
                              height: mediaSize.height,
                              transform: `translate(-50%, -50%) ${cropTransform}`,
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                    {cropBoxSize && cropBoxMaxSize ? (
                      <FreeCropResizeHandles
                        cropSize={cropBoxSize}
                        aspect={aspect === 0 ? undefined : resolvedAspect}
                        frameColors={cropFrameColors}
                        maxCropSize={cropBoxMaxSize}
                        showGrid={isCropInteracting}
                        onInteractionStart={handleCropInteractionStart}
                        onInteractionEnd={handleCropInteractionEnd}
                        onResize={handleCropBoxResize}
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "[container-type:size] flex items-center justify-center",
                    VIEWER_IMAGE_CANVAS_CLASS,
                    expanded &&
                      "max-sm:pr-20 sm:max-lg:pr-[26rem] lg:pr-[32rem]",
                  )}
                >
                  {displayUrl ? (
                    <ProgressiveViewerImage
                      key={viewerImageUrl}
                      displayUrl={displayUrl}
                      originalUrl={viewerImageUrl}
                      alt={asset?.alt ?? ""}
                      aspectRatio={viewerAspectRatio}
                      imageRef={viewerImageRef}
                      pickMode={isEyeDropping}
                      onPick={handlePickColorResult}
                      loadSamplingCanvas={loadSamplingCanvas}
                      animateLayout={Boolean(assetModalId) && !sharedMorphing}
                      layoutDependency={presentation}
                      layoutTransition={fullscreenLayoutTransition}
                    />
                  ) : loading ? (
                    <Skeleton
                      data-asset-modal-hero
                      className="rounded-lg bg-white/10"
                      style={{
                        width: "min(100cqw, calc(100cqh * 1.333333), 64rem)",
                        height: "min(100cqh, calc(100cqw / 1.333333), 48rem)",
                      }}
                      role="status"
                      aria-label="Loading image"
                    />
                  ) : null}
                </div>
              )}
              {hasImageNavigation && !cropMode ? (
                <ImageNavigationControls
                  currentAssetIndex={currentAssetIndex}
                  assetCount={assets.length}
                  previousAsset={previousAsset}
                  nextAsset={nextAsset}
                  expanded={expanded}
                  onAssetChange={handleAssetChange}
                />
              ) : null}
            </div>

            <motion.aside
              layout={Boolean(assetModalId) && !sharedMorphing}
              layoutDependency={presentation}
              transition={{ layout: fullscreenLayoutTransition }}
              className={cn(
                "pointer-events-auto z-20 flex min-h-0 flex-col overflow-hidden",
                expanded
                  ? cn(
                      GLASS_FRAME_CLASS,
                      "absolute top-[var(--app-shell-inset)] right-[var(--app-shell-inset)] bottom-[var(--app-shell-inset)] w-[min(20rem,calc(100%-1rem))] rounded-xl sm:w-80 lg:w-[25rem]",
                    )
                  : "relative w-80 shrink-0 bg-background shadow-none",
              )}
            >
              {expanded ? (
                <header className="flex h-12 w-full shrink-0 items-center justify-between gap-1 px-3 [&_[data-slot=button]]:duration-75">
                  {imageActionProps ? (
                    <ImageViewerActions {...imageActionProps} />
                  ) : null}
                </header>
              ) : null}
              <div
                className={cn(
                  "relative flex min-h-0 flex-1 flex-col",
                  expanded ? "bg-transparent" : "bg-background",
                )}
              >
                <AnimatePresence initial={false} mode="sync">
                  {cropMode && asset ? (
                    <motion.section
                      key="image-edit-controls"
                      layout="position"
                      initial={
                        shouldReduceMotion
                          ? false
                          : {
                              opacity: 1,
                              height: 0,
                              clipPath: "inset(0 0 100% 0)",
                            }
                      }
                      animate={{
                        opacity: 1,
                        height: "auto",
                        clipPath: "inset(0 0 0% 0)",
                      }}
                      exit={
                        shouldReduceMotion
                          ? undefined
                          : {
                              opacity: 1,
                              height: 0,
                              clipPath: "inset(0 0 0% 0)",
                            }
                      }
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
                      }
                      className={cn(
                        "relative overflow-hidden bg-background shadow-none",
                        expanded &&
                          "rounded-t-xl border-t border-foreground/10",
                      )}
                      aria-label="Edit image"
                    >
                      <div className="relative z-10 space-y-5 rounded-t-xl px-4 py-4">
                        <CropToolbar
                          aspect={aspect}
                          zoom={zoom}
                          flipX={flipX}
                          flipY={flipY}
                          onAspectChange={handleAspectChange}
                          onZoomChange={handleZoomChange}
                          onRotate={handleRotate}
                          onFlipHorizontal={handleFlipHorizontal}
                          onFlipVertical={handleFlipVertical}
                        />
                        {cropError ? (
                          <p className="text-xs text-destructive" role="alert">
                            {cropError}
                          </p>
                        ) : null}
                      </div>
                      <div className="relative z-0 flex gap-2 px-4 py-4">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mr-auto bg-muted hover:bg-muted/80 active:bg-muted/70"
                                onClick={handleResetCrop}
                                disabled={!hasCropChanges || isSavingCrop}
                              />
                            }
                          >
                            <RotateCcwIcon className="size-3.5" />
                            Reset
                          </TooltipTrigger>
                          <TooltipContent>Reset crop</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleCancelCrop}
                                disabled={isSavingCrop}
                              />
                            }
                          >
                            Discard
                          </TooltipTrigger>
                          <TooltipContent>Discard changes</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={handleApplyCrop}
                                disabled={isSavingCrop}
                              />
                            }
                          >
                            Apply
                          </TooltipTrigger>
                          <TooltipContent>Apply crop</TooltipContent>
                        </Tooltip>
                      </div>
                    </motion.section>
                  ) : null}
                </AnimatePresence>
                <motion.div
                  layout
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
                  }
                  className={cn(
                    "relative z-20 min-h-0 flex flex-1 flex-col before:pointer-events-none before:absolute before:inset-x-0 before:-top-2 before:z-0 before:h-3 before:bg-background before:opacity-0 before:transition-opacity before:duration-150 before:content-['']",
                    expanded ? "bg-transparent" : "bg-card",
                    cropMode && "before:opacity-100",
                  )}
                >
                  <div
                    className={cn(
                      "relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background",
                      (expanded || cropMode) &&
                        "rounded-t-xl border-t border-foreground/10",
                    )}
                  >
                    <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:inset-y-2 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:right-1">
                      <motion.div
                        layout="position"
                        className="px-4 pt-4 pb-4 lg:px-5"
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
                        }
                      >
                        {loading ? <ImageViewerDetailsLoading /> : null}
                        {asset?.sourceUrl ? (
                          <div className="mb-5">
                            <span className="text-xs font-medium text-muted-foreground">
                              Source
                            </span>
                            <a
                              href={asset.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-primary transition-colors hover:text-foreground"
                            >
                              <ExternalLinkIcon className="size-3.5 shrink-0" />
                              {sourceLabel ?? "Source"}
                            </a>
                          </div>
                        ) : null}

                        {asset ? (
                          <div className="pb-5">
                            <ImageColorPalette asset={asset} compact />
                          </div>
                        ) : null}
                        {asset ? (
                          <div className="mb-5">
                            <label
                              htmlFor="image-note"
                              className="text-xs font-medium text-muted-foreground"
                            >
                              Notes
                            </label>
                            <AutoResizeTextarea
                              ref={imageNoteRef}
                              id="image-note"
                              spellCheck={false}
                              value={imageNote}
                              onChange={(event) =>
                                handleImageNoteChange(event.target.value)
                              }
                              placeholder="Add a note"
                              rows={1}
                              className="mt-1 block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
                            />
                          </div>
                        ) : null}
                        {!cropMode && cropError ? (
                          <p
                            className="mt-4 text-xs text-destructive"
                            role="alert"
                          >
                            {cropError}
                          </p>
                        ) : null}
                      </motion.div>
                    </ScrollArea>
                    {asset ? (
                      <footer className="shrink-0 px-4 pb-4 lg:px-5">
                        <div className="border-t border-border pt-4">
                          <ImageMetadataDetails asset={asset} />
                        </div>
                      </footer>
                    ) : loading ? (
                      <ImageMetadataLoading />
                    ) : null}
                  </div>
                </motion.div>
              </div>
            </motion.aside>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ImageViewerDetailsLoading() {
  return (
    <div role="status" aria-label="Loading image details">
      <div className="mb-5">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="mt-2 h-4 w-3/4" />
      </div>
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-12" />
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="size-8 rounded-sm" />
          ))}
        </div>
      </div>
      <div className="mb-5">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
    </div>
  );
}

function ImageMetadataLoading() {
  return (
    <footer className="shrink-0 px-4 pb-4 lg:px-5" aria-hidden="true">
      <div className="space-y-3 border-t border-border pt-4">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </footer>
  );
}
