import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { VideoAsset } from "@/types/asset";
import {
  formatVideoDuration,
  VIDEO_CARD_TIME_BADGE_CLASS,
} from "@/components/board/video-card-control-styles";
import { hasSelectionModifier } from "@/lib/selection";
import { recordVideoPlaybackPosition } from "@/lib/video-playback-position";
import { useVideoUploadPreview } from "@/lib/video-upload-preview";
import { cn } from "@/lib/utils";

export function VideoAssetCard({
  asset,
  onOpen,
  isContextMenuOpen = false,
  selected = false,
  dragging = false,
}: {
  asset: VideoAsset;
  onOpen?: () => void;
  isContextMenuOpen?: boolean;
  selected?: boolean;
  dragging?: boolean;
}) {
  const uploadPreview = useVideoUploadPreview(asset.id);
  const localSourceUrl =
    uploadPreview?.status === "processing"
      ? uploadPreview.sourceUrl
      : undefined;
  const playbackUrl = localSourceUrl ?? asset.url;
  const ready = Boolean(playbackUrl);
  const reduceMotion = useReducedMotion();
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const posterUrl = uploadPreview?.posterUrl ?? asset.posterUrl;
  const width = asset.width ?? uploadPreview?.width;
  const height = asset.height ?? uploadPreview?.height;

  const stopPreview = () => {
    setPreviewing(false);
    setPreviewVisible(false);
    setPreviewTime(0);
  };

  const recordPreviewPosition = () => {
    const video = previewVideoRef.current;
    if (previewing && video) {
      recordVideoPlaybackPosition(asset.id, video.currentTime);
    }
  };

  useEffect(() => {
    if (!reduceMotion && !dragging) return;
    setPreviewing(false);
    setPreviewVisible(false);
    setPreviewTime(0);
  }, [dragging, reduceMotion]);

  return (
    <div
      data-asset-card-surface
      className={cn(
        "group relative overflow-hidden rounded-lg border border-transparent bg-sidebar-foreground/8 transition-colors duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        ready && onOpen && "cursor-pointer",
        !selected && ready && "hover:border-sidebar-foreground/20",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
      style={{
        aspectRatio: width && height ? `${width} / ${height}` : "16 / 9",
      }}
      role={ready && onOpen ? "button" : undefined}
      tabIndex={ready && onOpen ? 0 : undefined}
      onClick={(event) => {
        if (!hasSelectionModifier(event) && ready) {
          recordPreviewPosition();
          onOpen?.();
        }
      }}
      onKeyDown={(event) => {
        if (ready && onOpen && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          recordPreviewPosition();
          onOpen();
        }
      }}
      onMouseEnter={() => {
        if (!ready || reduceMotion || dragging) return;
        setPreviewing(true);
      }}
      onMouseLeave={stopPreview}
      aria-label={ready ? `Open video: ${asset.title ?? "Video"}` : undefined}
    >
      <div
        data-asset-card-hero="video"
        className="absolute inset-0 overflow-hidden rounded-[6px]"
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        ) : uploadPreview?.sourceUrl ? (
          <video
            src={uploadPreview.sourceUrl}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
        ) : playbackUrl ? (
          <video
            src={playbackUrl}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        {previewing && playbackUrl ? (
          <video
            ref={previewVideoRef}
            src={playbackUrl}
            poster={posterUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            aria-hidden="true"
            className={cn(
              "absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out will-change-[opacity] motion-reduce:transition-none",
              previewVisible ? "opacity-100" : "opacity-0",
            )}
            onPlaying={() => setPreviewVisible(true)}
            onTimeUpdate={(event) => {
              const seconds = event.currentTarget.currentTime;
              const wholeSeconds = Math.floor(seconds);
              setPreviewTime((current) =>
                current === wholeSeconds ? current : wholeSeconds,
              );
            }}
          />
        ) : null}
      </div>
      {ready && asset.durationSeconds ? (
        <span
          className={cn(
            "absolute right-2 bottom-2",
            VIDEO_CARD_TIME_BADGE_CLASS,
          )}
        >
          {formatVideoDuration(
            previewing
              ? Math.max(0, asset.durationSeconds - previewTime)
              : asset.durationSeconds,
          )}
        </span>
      ) : null}
      {!ready && asset.processingStatus === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
          <AlertCircleIcon className="size-5 text-destructive" />
          <span className="text-sm font-medium">Video could not be added</span>
          <span className="text-xs text-muted-foreground">
            {asset.processingError ?? "Processing failed"}
          </span>
        </div>
      ) : null}
      <AnimatePresence initial={false}>
        {!ready && asset.processingStatus !== "failed" ? (
          <motion.div
            key="video-progress"
            exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5"
          >
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-popover/85 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
              <LoaderCircleIcon className="size-3 animate-spin" />
              {uploadPreview?.status === "uploading" ? (
                <span>
                  Uploading{" "}
                  <span className="font-mono tabular-nums">
                    {uploadPreview.progress}%
                  </span>
                </span>
              ) : (
                <span>{uploadPreview ? "Preparing video" : "Importing"}</span>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
