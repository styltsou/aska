import { Fragment } from "react";
import type { ImageAsset } from "@/types/asset";

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
        <span className="text-xs font-medium text-muted-foreground">
          Colors
        </span>
        {dominantColors.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {dominantColors.map((color) => (
              <span
                key={color}
                title={color.toUpperCase()}
                aria-label={`Dominant color ${color}`}
                className="size-5 rounded-sm border border-black/10 shadow-sm dark:border-white/15"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unavailable</span>
        )}
      </div>
    </div>
  );
}
