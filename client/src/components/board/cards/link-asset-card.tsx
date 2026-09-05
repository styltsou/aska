import { ExternalLinkIcon, Globe2Icon, PlayIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { ProgressiveImage } from "@/components/ui/progressive-image";
import { hasSelectionModifier } from "@/lib/selection";
import { isYouTubeVideoUrl } from "@/lib/youtube-url";
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
  const [loadedPreviewUrl, setLoadedPreviewUrl] = useState<string | null>(null);
  const isYoutube =
    asset.video?.provider === "youtube" || isYouTubeVideoUrl(asset.originalUrl);

  const previewLoaded = loadedPreviewUrl === asset.previewImage?.url;

  const className = cn(
    "group relative block w-full overflow-hidden rounded-lg border bg-sidebar text-left text-sidebar-foreground transition-colors hover:border-sidebar-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
    onOpen && "cursor-pointer",
    isContextMenuOpen && "border-sidebar-foreground/20",
  );
  const contents = (
    <>
      <div className="min-h-0 p-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-muted/40">
          {asset.previewImage ? (
            <ProgressiveImage
              src={asset.previewImage.url}
              blurDataURL={asset.previewImage.blurDataURL}
              alt={asset.previewImage.alt ?? ""}
              className={cn(
                "size-full object-cover",
                !isYoutube &&
                  "!transition-all duration-150 ease-out group-hover:scale-[1.05] motion-reduce:transition-none",
              )}
              onLoad={() =>
                setLoadedPreviewUrl(asset.previewImage?.url ?? null)
              }
            />
          ) : null}
          <AnimatePresence initial={false}>
            {(!asset.previewImage || !previewLoaded) && (
              <motion.div
                key="link-preview-placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                data-slot="optimistic-link-preview"
                className="link-preview-shimmer pointer-events-none absolute inset-0 z-10"
              />
            )}
          </AnimatePresence>
          {onOpen ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex size-11 items-center justify-center rounded-full border border-border/70 bg-popover/85 text-popover-foreground shadow-lg ring-1 ring-border/30 backdrop-blur-sm transition-[background-color,transform] duration-150 group-hover:scale-105 group-hover:bg-popover motion-reduce:transition-none">
                <PlayIcon className="ml-0.5 size-4 fill-current" />
              </span>
            </div>
          ) : null}
          {onOpen ? (
            <a
              href={asset.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-lg border border-border/70 bg-popover/85 text-popover-foreground opacity-100 shadow-sm backdrop-blur-sm transition-[background-color,opacity] hover:bg-popover focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:opacity-0 sm:group-hover:opacity-100"
              onClick={(event) => event.stopPropagation()}
              aria-label="Open on YouTube in a new tab"
            >
              <ExternalLinkIcon className="size-3.5" />
            </a>
          ) : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-2 right-2 z-10 flex size-7 items-center justify-center rounded-lg border border-border/70 bg-popover/85 text-popover-foreground opacity-100 shadow-sm backdrop-blur-sm transition-[background-color,opacity] duration-150 ease-out group-hover:bg-popover sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ExternalLinkIcon className="size-3.5" />
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1 bg-sidebar px-3 pb-3">
        <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/60">
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
        </div>
        <div className="line-clamp-2 text-sm leading-snug font-medium">
          {asset.title}
        </div>
        {asset.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-sidebar-foreground/60">
            {asset.description}
          </p>
        ) : asset.resolutionStatus === "failed" ? (
          <p className="text-xs text-sidebar-foreground/60">
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
    </div>
  );
}
