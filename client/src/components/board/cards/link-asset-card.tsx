import {
  Globe2Icon,
  ImageOffIcon,
  UserRoundIcon,
} from "lucide-react";
import { useState, type MouseEvent } from "react";

import { ProgressiveImage } from "@/components/ui/progressive-image";
import { YouTubeDescription } from "@/components/board/youtube-description";
import { hasSelectionModifier } from "@/lib/selection";
import { isYouTubeVideoUrl } from "@/lib/youtube-url";
import { cn } from "@/lib/utils";
import type { FolderAssetPreview } from "@/types/asset";
import type { LinkAsset } from "@/types/asset";

const YOUTUBE_THUMBNAIL_URL = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
const LINK_CARD_META_CLASS =
  "flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-sidebar-foreground/65";

function LinkPreviewUnavailable({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label="Preview unavailable"
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
    >
      <ImageOffIcon className={compact ? "size-5" : "size-6"} />
      <span className={compact ? "text-[10px]" : "text-xs"}>
        Preview unavailable
      </span>
    </div>
  );
}

function YouTubePlayMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 68 48"
      aria-hidden="true"
      className={cn(
        "fill-[#f00] drop-shadow-[0_2px_6px_rgb(0_0_0_/_0.28)]",
        compact ? "h-5 w-7" : "h-8 w-11",
      )}
    >
      <path d="M66.52 7.74c-.78-2.93-3.09-5.24-6.02-6.02C55.04.25 33 .25 33 .25S10.96.25 5.5 1.72A8.01 8.01 0 0 0-.52 7.74C-2 13.2-2 24-2 24s0 10.8 1.48 16.26c.78 2.93 3.09 5.24 6.02 6.02C10.96 47.75 33 47.75 33 47.75s22.04 0 27.5-1.47c2.93-.78 5.24-3.09 6.02-6.02C68 34.8 68 24 68 24s0-10.8-1.48-16.26Z" />
      <path
        d="M27.95 14.61c-.99-.61-2.2.1-2.2 1.27v16.24c0 1.17 1.21 1.88 2.2 1.27l13.26-8.12a1.5 1.5 0 0 0 0-2.55l-13.26-8.11Z"
        fill="white"
      />
    </svg>
  );
}

function ChannelAvatar({
  src,
  compact = false,
}: {
  src?: string;
  compact?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span
      data-slot="channel-avatar"
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-foreground/8 text-sidebar-foreground/55 ring-1 ring-sidebar-foreground/10",
        compact ? "size-3.5" : "size-4.5",
      )}
    >
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <UserRoundIcon className={compact ? "size-2.5" : "size-3"} />
      )}
    </span>
  );
}

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
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string>();
  const isPreviewResolving =
    asset.resolutionStatus === "queued" ||
    asset.resolutionStatus === "resolving";
  const isPreviewUnavailable =
    (!previewUrl && !isPreviewResolving) ||
    Boolean(previewUrl && failedPreviewUrl === previewUrl && !previewFallback);
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
    "group relative block w-full overflow-hidden rounded-lg border border-border bg-sidebar text-left text-sidebar-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
    onOpen && "cursor-pointer",
    !selected && "hover:border-sidebar-foreground/20",
    isContextMenuOpen && "border-sidebar-foreground/20",
  );
  const contents = (
    <>
      <div
        data-asset-card-hero={onOpen ? "" : undefined}
        className="relative z-10 aspect-video w-full overflow-hidden rounded-b-lg border-b border-border bg-muted/40"
      >
        {previewUrl && failedPreviewUrl !== previewUrl ? (
          <ProgressiveImage
            src={previewUrl}
            fallbackSrc={previewFallback}
            blurDataURL={asset.previewImage?.blurDataURL}
            alt={asset.previewImage?.alt ?? ""}
            className="absolute inset-0 size-full object-cover !transition-all duration-150 ease-out group-hover:scale-[1.05] motion-reduce:transition-none"
            onError={
              previewFallback
                ? undefined
                : () => setFailedPreviewUrl(previewUrl)
            }
          />
        ) : null}
        {!previewUrl && isPreviewResolving ? (
          <div
            data-slot="optimistic-link-preview"
            className="pointer-events-none absolute inset-0 z-10 animate-[preview-shimmer_1.6s_linear_infinite] bg-[linear-gradient(110deg,var(--muted)_18%,color-mix(in_oklch,var(--muted)_88%,var(--foreground))_46%,var(--muted)_74%)] [background-size:220%_100%] motion-reduce:animate-none"
          />
        ) : null}
        {isPreviewUnavailable ? <LinkPreviewUnavailable /> : null}
        {onOpen &&
        isYoutube &&
        (!previewUrl || failedPreviewUrl !== previewUrl) ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <YouTubePlayMark />
          </div>
        ) : null}
      </div>
      <div className="relative z-0 space-y-1 bg-sidebar px-3 pt-3 pb-3">
        {!isYoutube ? (
          <div className={LINK_CARD_META_CLASS}>
            <span className="flex size-4.5 shrink-0 items-center justify-center">
              {asset.favicon ? (
                <img
                  src={asset.favicon.url}
                  alt=""
                  className="size-4 rounded-sm object-contain"
                />
              ) : (
                <Globe2Icon className="size-4" />
              )}
            </span>
            <span className="min-w-0 truncate">
              {asset.siteName || asset.hostname}
            </span>
          </div>
        ) : null}
        {isYoutubeMetadataLoading ? (
          <div className="space-y-1.5 py-0.5">
            <div className="h-4 w-full animate-pulse rounded bg-sidebar-foreground/10" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-sidebar-foreground/10" />
          </div>
        ) : (
          <div className="line-clamp-2 text-base leading-snug font-medium">
            {asset.title}
          </div>
        )}
        {isYoutubeMetadataLoading ? (
          <div className="flex items-center gap-1.5">
            <span className="size-4.5 shrink-0 animate-pulse rounded-full bg-sidebar-foreground/10" />
            <span className="h-3.5 w-28 animate-pulse rounded bg-sidebar-foreground/10" />
          </div>
        ) : isYoutube && channelName ? (
          <div className={LINK_CARD_META_CLASS}>
            <ChannelAvatar src={asset.video?.channelAvatarUrl} />
            <span className="min-w-0 truncate">{channelName}</span>
          </div>
        ) : null}
        {asset.description ? (
          youtubeVideoId ? (
            <YouTubeDescription
              description={asset.description}
              videoId={youtubeVideoId}
              interactive={false}
              className="line-clamp-2 text-xs leading-relaxed whitespace-pre-line text-sidebar-foreground/60"
            />
          ) : (
            <p className="line-clamp-2 text-xs leading-relaxed whitespace-pre-line text-sidebar-foreground/60">
              {asset.description}
            </p>
          )
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
            The link still works
          </p>
        ) : null}
      </div>
    </>
  );

  if (!onOpen) {
    return (
      <a
        data-asset-card-outline
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
      data-asset-card-surface
      data-asset-card-outline
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
  | "siteName"
  | "title"
  | "favicon"
  | "videoId"
  | "channelName"
  | "channelAvatarUrl"
  | "description"
> &
  Partial<Pick<FolderAssetPreview, "assetId" | "type">>;

/** Full-size card content, sized to fill its container and clipped by it. */
export function LinkCardPreview({
  preview,
  className,
  variant = "default",
}: {
  preview: LinkCardPreviewData;
  className?: string;
  variant?: "default" | "collection";
}) {
  const compact = variant === "collection";
  const isYoutube = Boolean(preview.videoId);
  const thumbnailUrl =
    preview.url ??
    (isYoutube && preview.videoId
      ? YOUTUBE_THUMBNAIL_URL(preview.videoId)
      : undefined);
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string>();
  const thumbnailAvailable =
    Boolean(thumbnailUrl) && failedThumbnailUrl !== thumbnailUrl;
  const displayTitle = preview.title?.trim() || "Untitled link";
  const hostname =
    preview.siteName || preview.hostname || (isYoutube ? "YouTube" : "Link");

  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col bg-card",
        compact ? "overflow-hidden bg-sidebar" : "h-full",
        className,
      )}
    >
      <div className="relative z-10 aspect-video w-full shrink-0 overflow-hidden rounded-b-lg border-b border-border bg-muted/40">
        {thumbnailAvailable ? (
          <ProgressiveImage
            src={thumbnailUrl!}
            blurDataURL={preview.blurDataURL}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
            onError={() => setFailedThumbnailUrl(thumbnailUrl)}
          />
        ) : (
          <LinkPreviewUnavailable compact={compact} />
        )}
        {isYoutube && thumbnailAvailable ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <YouTubePlayMark compact={compact} />
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "relative z-0 flex flex-col bg-sidebar",
          compact ? "gap-0.5 px-2 pt-2 pb-2" : "gap-1 px-2 py-2",
        )}
      >
        {!isYoutube ? (
          <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-sidebar-foreground/60">
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
        ) : null}
        <div
          className={cn(
            "font-medium text-sidebar-foreground",
            compact
              ? "shrink-0 truncate text-xs leading-snug"
              : "line-clamp-2 text-sm leading-snug",
          )}
        >
          {displayTitle}
        </div>
        {isYoutube && preview.channelName?.trim() ? (
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 text-[11px] leading-4 text-sidebar-foreground/65">
            <ChannelAvatar src={preview.channelAvatarUrl} compact={compact} />
            <span className="min-w-0 truncate">{preview.channelName}</span>
          </div>
        ) : null}
        {preview.description?.trim() ? (
          preview.videoId ? (
            <YouTubeDescription
              description={preview.description.trim()}
              videoId={preview.videoId}
              interactive={false}
              className={cn(
                "text-muted-foreground",
                compact
                  ? "line-clamp-3 text-[11px] leading-snug whitespace-pre-line"
                  : "line-clamp-3 text-xs leading-snug whitespace-pre-line",
              )}
            />
          ) : (
            <div
              className={cn(
                "text-muted-foreground",
                compact
                  ? "line-clamp-3 text-[11px] leading-snug whitespace-pre-line"
                  : "line-clamp-3 text-xs leading-snug whitespace-pre-line",
              )}
            >
              {preview.description.trim()}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
