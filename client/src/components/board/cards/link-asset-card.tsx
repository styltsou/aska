import { ExternalLinkIcon, Globe2Icon, LoaderCircleIcon } from "lucide-react";

import { ProgressiveImage } from "@/components/ui/progressive-image";
import { cn } from "@/lib/utils";
import type { LinkAsset } from "@/types/asset";

export function LinkAssetCard({
  asset,
  isContextMenuOpen = false,
}: {
  asset: LinkAsset;
  isContextMenuOpen?: boolean;
}) {
  const active =
    asset.resolutionStatus === "queued" ||
    asset.resolutionStatus === "resolving";

  return (
    <a
      href={asset.originalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group grid aspect-square w-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-card-foreground transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        isContextMenuOpen && "border-foreground/20",
      )}
      onClick={(event) => event.stopPropagation()}
      aria-label={`Open ${asset.title}`}
    >
      <div className="relative min-h-0 overflow-hidden bg-muted/40">
        {asset.previewImage ? (
          <ProgressiveImage
            src={asset.previewImage.url}
            blurDataURL={asset.previewImage.blurDataURL}
            alt={asset.previewImage.alt ?? ""}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_top_left,var(--color-muted),transparent_70%)]">
            <Globe2Icon className="size-10 text-muted-foreground/30" />
          </div>
        )}
        {active ? (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
            <LoaderCircleIcon className="size-3 animate-spin" />
            Resolving
          </div>
        ) : null}
      </div>
      <div className="space-y-1 border-t bg-card px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {asset.favicon ? (
            <img
              src={asset.favicon.url}
              alt=""
              className="size-3.5 rounded-sm object-contain"
            />
          ) : (
            <Globe2Icon className="size-3.5" />
          )}
          <span className="truncate">{asset.siteName || asset.hostname}</span>
          <ExternalLinkIcon className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
        </div>
        <div className="line-clamp-2 text-sm leading-snug font-medium">
          {asset.title}
        </div>
        {asset.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {asset.description}
          </p>
        ) : asset.resolutionStatus === "failed" ? (
          <p className="text-xs text-muted-foreground">
            Preview unavailable · link still works
          </p>
        ) : null}
      </div>
    </a>
  );
}
