import {
  ExternalLinkIcon,
  Globe2Icon,
  LoaderCircleIcon,
  PlayIcon,
} from "lucide-react";

import { ProgressiveImage } from "@/components/ui/progressive-image";
import { hasSelectionModifier } from "@/lib/selection";
import { cn } from "@/lib/utils";
import type { LinkAsset } from "@/types/asset";

export function LinkAssetCard({
  asset,
  onOpen,
  isContextMenuOpen = false,
}: {
  asset: LinkAsset;
  onOpen?: () => void;
  isContextMenuOpen?: boolean;
}) {
  const active =
    asset.resolutionStatus === "queued" ||
    asset.resolutionStatus === "resolving";

  const className = cn(
    "group relative grid aspect-square w-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-card text-left text-card-foreground transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
    onOpen && "cursor-pointer",
    isContextMenuOpen && "border-foreground/20",
  );
  const contents = (
    <>
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
        {onOpen ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-sm transition-transform duration-150 group-hover:scale-105 motion-reduce:transition-none">
              <PlayIcon className="ml-0.5 size-4 fill-current" />
            </span>
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
          {!onOpen ? (
            <ExternalLinkIcon className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          ) : null}
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
    </>
  );

  if (!onOpen) {
    return (
      <a
        href={asset.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Open ${asset.title}`}
      >
        {contents}
      </a>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={className}
      onClick={(event) => {
        if (!hasSelectionModifier(event)) onOpen();
      }}
      onKeyDown={(event) => {
        if (
          event.target !== event.currentTarget ||
          (event.key !== "Enter" && event.key !== " ")
        )
          return;
        event.preventDefault();
        onOpen();
      }}
      aria-label={`Open video details: ${asset.title}`}
    >
      {contents}
      <a
        href={asset.originalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white opacity-100 shadow-sm backdrop-blur-sm transition-[background-color,opacity] hover:bg-black/70 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none sm:opacity-0 sm:group-hover:opacity-100"
        onClick={(event) => event.stopPropagation()}
        aria-label="Open on YouTube in a new tab"
      >
        <ExternalLinkIcon className="size-3.5" />
      </a>
    </div>
  );
}
