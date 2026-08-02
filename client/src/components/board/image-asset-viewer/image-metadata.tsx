import { Fragment, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
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

function ColorRow({ color }: { color: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const [label, setLabel] = useState<"Copy" | "Copied">("Copy");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredRef = useRef(false);

  const copy = () => {
    navigator.clipboard.writeText(color.toUpperCase());
    setIsCopied(true);
    setLabel("Copied");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsCopied(false);
      if (hoveredRef.current) setLabel("Copy");
    }, 1500);
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <button
      type="button"
      onClick={copy}
      onMouseEnter={() => {
        hoveredRef.current = true;
        if (!isCopied) setLabel("Copy");
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
      }}
      aria-label={`Copy ${color}`}
      className="group flex w-full cursor-pointer items-center gap-3.5 px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span
        className="size-7 shrink-0 rounded-sm border border-black/10 shadow-sm dark:border-white/15"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-sm tabular-nums text-foreground/80">
        {color.toUpperCase()}
      </span>
      <span
        className={cn(
          "ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity duration-100 group-hover:opacity-100",
          isCopied && "opacity-100",
        )}
      >
        <Icon className="size-3.5" />
        {label}
      </span>
    </button>
  );
}

export function ImageMetadata({ asset }: { asset: ImageAsset }) {
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

  if (asset.createdAt) {
    metaRows.push({ label: "Added", value: formatDate(asset.createdAt) });
  }

  if (asset.alt) {
    metaRows.push({ label: "Alt text", value: asset.alt });
  }

  const dominantColors = (asset.dominantColors ?? [])
    .filter((color) => /^#[\da-f]{6}$/i.test(color))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm">
        {metaRows.map(({ label, value }) => (
          <Fragment key={label}>
            <dt className="text-xs font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="min-w-0 text-right wrap-break-word text-foreground/90">
              {value}
            </dd>
          </Fragment>
        ))}
      </dl>
      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted-foreground">
          Colors
        </span>
        {dominantColors.length > 0 ? (
          <div className="space-y-1">
            {dominantColors.map((color) => (
              <ColorRow key={color} color={color} />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unavailable</span>
        )}
      </div>
    </div>
  );
}
