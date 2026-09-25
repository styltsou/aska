import "./link-asset-card.css";

import { ExternalLinkIcon, Globe2Icon, PlayIcon } from "lucide-react";
import type { MouseEvent } from "react";

import { ProgressiveImage } from "@/components/ui/progressive-image";
import { hasSelectionModifier } from "@/lib/selection";
import { isYouTubeVideoUrl } from "@/lib/youtube-url";
import { cn } from "@/lib/utils";
import type { FolderAssetPreview } from "@/types/asset";
import type { LinkAsset } from "@/types/asset";

const YOUTUBE_THUMBNAIL_URL = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

export function handleLinkCardNavigationClick(
  event: Pick<
    MouseEvent<HTMLAnchorElement>,
    "ctrlKey" | "metaKey" | "preventDefault" | "stopPropagation"
  >,
) {
  if (hasSelectionModifier(event)) {
    event.preventDefault();
    return;
  }
  event.stopPropagation();
}

export function LinkAssetCard({
  asset,
  onOpen,
  isContextMenuOpen = false,
  selected = false,
}: {
  asset: LinkAsset;
  onOpen?: () => void;
  isContextMenuOpen?: boolean;
  selected?: boolean;
}) {
  const isYoutube =
    asset.video?.provider === "youtube" || isYouTubeVideoUrl(asset.originalUrl);
  const optimisticYoutube = asset.optimisticYouTube;
  const youtubeVideoId = asset.video?.videoId ?? optimisticYoutube?.videoId;
  const directYoutubeThumbnail = youtubeVideoId
    ? YOUTUBE_THUMBNAIL_URL(youtubeVideoId)
    : undefined;
  const previewUrl = asset.previewImage?.url ?? directYoutubeThumbnail;
  const previewFallback =
    directYoutubeThumbnail && previewUrl !== directYoutubeThumbnail
      ? directYoutubeThumbnail
      : undefined;
  const isOptimisticYoutube =
    Boolean(optimisticYoutube) &&
    (asset.resolutionStatus === "queued" ||
      asset.resolutionStatus === "resolving");
  const isYoutubeMetadataLoading =
    isOptimisticYoutube && optimisticYoutube?.metadataStatus === "loading";
  const isYoutubeDescriptionLoading = isOptimisticYoutube && !asset.description;
  const channelName =
    asset.video?.channelName ?? optimisticYoutube?.channelName;

  const className = cn(
    "group relative block w-full overflow-hidden rounded-lg border bg-sidebar text-left text-sidebar-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
    onOpen && "cursor-pointer",
    !selected && "hover:border-sidebar-foreground/20",
    isContextMenuOpen && "border-sidebar-foreground/20",
  );
  const contents = (
    <>
      <div className="min-h-0 p-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-muted/40">
          {previewUrl ? (
            <ProgressiveImage
              src={previewUrl}
              fallbackSrc={previewFallback}
              blurDataURL={asset.previewImage?.blurDataURL}
              alt={asset.previewImage?.alt ?? ""}
              className={cn(
                "absolute inset-0 size-full object-cover",
                !isYoutube &&
                  "!transition-all duration-150 ease-out group-hover:scale-[1.05] motion-reduce:transition-none",
              )}
            />
          ) : null}
          {!previewUrl &&
          (asset.resolutionStatus === "queued" ||
            asset.resolutionStatus === "resolving") ? (
            <div
              data-slot="optimistic-link-preview"
              className="pointer-events-none absolute inset-0 z-10 animate-[link-preview-shimmer_1.6s_linear_infinite] bg-[linear-gradient(110deg,var(--muted)_18%,color-mix(in_oklch,var(--muted)_88%,var(--foreground))_46%,var(--muted)_74%)] [background-size:220%_100%] motion-reduce:animate-none"
            />
          ) : null}
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
          {isYoutubeMetadataLoading ? (
            <span className="h-3 w-28 animate-pulse rounded bg-sidebar-foreground/10" />
          ) : (
            <span className="truncate">
              {isYoutube
                ? channelName
                  ? `YouTube · ${channelName}`
                  : "YouTube"
                : asset.siteName || asset.hostname}
            </span>
          )}
        </div>
        {isYoutubeMetadataLoading ? (
          <div className="space-y-1.5 py-0.5">
            <div className="h-3.5 w-full animate-pulse rounded bg-sidebar-foreground/10" />
            <div className="h-3.5 w-3/5 animate-pulse rounded bg-sidebar-foreground/10" />
          </div>
        ) : (
          <div className="line-clamp-2 text-sm leading-snug font-medium">
            {asset.title}
          </div>
        )}
        {asset.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed whitespace-pre-line text-sidebar-foreground/60">
            {asset.description}
          </p>
        ) : isYoutubeDescriptionLoading ? (
          <div
            className="space-y-1.5 pt-1"
            aria-label="Loading video description"
          >
            <div className="h-2.5 w-full animate-pulse rounded bg-sidebar-foreground/10" />
            <div className="h-2.5 w-4/5 animate-pulse rounded bg-sidebar-foreground/10" />
          </div>
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
        onClick={handleLinkCardNavigationClick}
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

type LinkCardPreviewData = Pick<
  FolderAssetPreview,
  | "url"
  | "blurDataURL"
  | "hostname"
  | "title"
  | "favicon"
  | "videoId"
  | "description"
> &
  Partial<Pick<FolderAssetPreview, "assetId" | "type">>;

/** Full-size card content, sized to fill its container and clipped by it. */
export function LinkCardPreview({
  preview,
  className,
}: {
  preview: LinkCardPreviewData;
  className?: string;
}) {
  const isYoutube = Boolean(preview.videoId);
  const thumbnailUrl =
    preview.url ??
    (isYoutube && preview.videoId
      ? YOUTUBE_THUMBNAIL_URL(preview.videoId)
      : undefined);
  const displayTitle = preview.title?.trim() || "Untitled link";
  const hostname = preview.hostname ?? "Link";

  return (
    <div
      className={cn("flex h-full w-full min-w-0 flex-col bg-card", className)}
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-sm bg-muted/40">
        {thumbnailUrl ? (
          <ProgressiveImage
            src={thumbnailUrl}
            blurDataURL={preview.blurDataURL}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Globe2Icon className="size-8 text-muted-foreground/40" />
          </div>
        )}
        {isYoutube ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-popover/85 text-popover-foreground shadow-lg ring-1 ring-border/30 backdrop-blur-sm">
              <PlayIcon className="ml-0.5 size-4 fill-current" />
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 px-2 pt-1.5 pb-2">
        <div className="flex items-center gap-1.5 text-[11px] text-sidebar-foreground/60">
          {preview.favicon ? (
            <img
              src={preview.favicon}
              alt=""
              className="size-3.5 rounded-sm object-contain"
            />
          ) : (
            <Globe2Icon className="size-3.5 shrink-0" />
          )}
          <span className="truncate">{hostname}</span>
        </div>
        <div className="line-clamp-2 text-sm leading-snug font-medium text-sidebar-foreground">
          {displayTitle}
        </div>
        {preview.description?.trim() ? (
          <div className="line-clamp-3 text-xs leading-snug whitespace-pre-line text-muted-foreground">
            {preview.description.trim()}
          </div>
        ) : null}
      </div>
    </div>
  );
}
