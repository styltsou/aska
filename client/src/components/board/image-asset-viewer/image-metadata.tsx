import { Fragment, useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, LoaderCircleIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ImageAsset } from "@/types/asset";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileType(contentType?: string): string {
  if (!contentType) return "Unknown";

  const knownTypes: Record<string, string> = {
    "image/avif": "AVIF",
    "image/bmp": "BMP",
    "image/gif": "GIF",
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/svg+xml": "SVG",
    "image/webp": "WEBP",
  };
  if (knownTypes[contentType]) return knownTypes[contentType];

  const subtype = contentType.split("/")[1]?.replace("+xml", "");
  return subtype ? subtype.toUpperCase() : contentType.toUpperCase();
}

function getSwatchIconColor(color: string): "text-black" | "text-white" {
  const value = Number.parseInt(color.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * toLinear(channels[0]) +
    0.7152 * toLinear(channels[1]) +
    0.0722 * toLinear(channels[2]);

  // Keep white as the default through midtones, then switch only for clearly
  // light swatches. This preserves a softer visual treatment while retaining
  // at least 3.5:1 contrast for the icon.
  return luminance > 0.25 ? "text-black" : "text-white";
}

function ColorRow({
  color,
  compact = false,
}: {
  color: string;
  compact?: boolean;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(color.toUpperCase());
      setIsCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  };
  const iconColor = getSwatchIconColor(color);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${color.toUpperCase()}`}
      className={cn(
        "group relative cursor-pointer rounded-sm border border-black/10 transition-transform duration-75 outline-none hover:scale-[0.985] focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.95] dark:border-white/15",
        compact ? "size-8" : "aspect-square w-full",
      )}
      style={{ backgroundColor: color }}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] bg-black/10 opacity-0 transition-opacity duration-75 group-hover:opacity-100 group-focus-visible:opacity-100",
          iconColor,
          isCopied && "opacity-100",
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={isCopied ? "copied" : "copy"}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.7 }}
            transition={{ duration: reduceMotion ? 0 : 0.08 }}
          >
            {isCopied ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}

export function ImageMetadataDetails({ asset }: { asset: ImageAsset }) {
  const originalWidth = asset.originalWidth ?? asset.width;
  const originalHeight = asset.originalHeight ?? asset.height;
  const metaRows: { label: string; value: string }[] = [
    {
      label: "Dimensions",
      value: `${originalWidth.toLocaleString()} x ${originalHeight.toLocaleString()}`,
    },
  ];

  if (asset.sizeBytes !== undefined) {
    metaRows.push({ label: "Size", value: formatSize(asset.sizeBytes) });
  }

  metaRows.push({ label: "Type", value: formatFileType(asset.contentType) });

  if (asset.createdAt) {
    metaRows.push({ label: "Added", value: formatDate(asset.createdAt) });
  }

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm">
      {metaRows.map(({ label, value }) => (
        <Fragment key={label}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-right wrap-break-word text-foreground/90">
            {value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function ImageColorPalette({
  asset,
  compact = false,
}: {
  asset: ImageAsset;
  compact?: boolean;
}) {
  const dominantColors = (asset.dominantColors ?? [])
    .filter((color) => /^#[\da-f]{6}$/i.test(color))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-muted-foreground">
        Colors
      </span>
      {dominantColors.length > 0 ? (
        <div
          className={cn(
            compact ? "flex flex-wrap gap-1.5" : "grid grid-cols-3 gap-1.5",
          )}
        >
          {dominantColors.map((color) => (
            <ColorRow key={color} color={color} compact={compact} />
          ))}
        </div>
      ) : asset.paletteStatus === "processing" ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <LoaderCircleIcon className="size-3 animate-spin" />
          Generating…
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Unavailable</span>
      )}
    </div>
  );
}
