import { AlertCircleIcon, LoaderCircleIcon, PlayIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import type { VideoAsset } from "@/types/asset";
import {
  VIDEO_CARD_PLAY_BUTTON_CLASS,
  VIDEO_CARD_TIME_BADGE_CLASS,
} from "@/components/board/video-card-control-styles";
import { hasSelectionModifier } from "@/lib/selection";
import { recordVideoPlaybackPosition } from "@/lib/video-playback-position";
import { useVideoUploadPreview } from "@/lib/video-upload-preview";
import { cn } from "@/lib/utils";

const HOVER_PREVIEW_DELAY_MS = 1_400;

function formatDuration(seconds: number) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = String(whole % 60).padStart(2, "0");
  return whole >= 3600
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

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
  const ready = asset.processingStatus === "completed" && !!asset.url;
  const uploadPreview = useVideoUploadPreview(asset.id);
  const reduceMotion = useReducedMotion();
  const hoverTimerRef = useRef<number | undefined>(undefined);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const posterUrl = asset.posterUrl ?? uploadPreview?.posterUrl;
  const width = asset.width ?? uploadPreview?.width;
  const height = asset.height ?? uploadPreview?.height;

  const stopPreview = () => {
    if (hoverTimerRef.current !== undefined) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = undefined;
    }
    setPreviewing(false);
    setPreviewTime(0);
  };

  const recordPreviewPosition = () => {
    const video = previewVideoRef.current;
    if (previewing && video) {
      recordVideoPlaybackPosition(asset.id, video.currentTime);
    }
  };

  useEffect(
    () => () => {
      if (hoverTimerRef.current !== undefined) {
        window.clearTimeout(hoverTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!reduceMotion && !dragging) return;
    if (hoverTimerRef.current !== undefined) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = undefined;
    }
    setPreviewing(false);
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
        hoverTimerRef.current = window.setTimeout(() => {
          hoverTimerRef.current = undefined;
          setPreviewing(true);
        }, HOVER_PREVIEW_DELAY_MS);
      }}
      onMouseLeave={stopPreview}
      onPointerDown={() => {
        if (hoverTimerRef.current !== undefined) {
          window.clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = undefined;
        }
      }}
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
        ) : null}
        {previewing && asset.url ? (
          <video
            ref={previewVideoRef}
            src={asset.url}
            poster={posterUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
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
      {ready ? (
        <>
          <span
            className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
              VIDEO_CARD_PLAY_BUTTON_CLASS,
              previewing && "opacity-0",
            )}
          >
            <PlayIcon className="ml-0.5 size-4 fill-current" />
          </span>
          {asset.durationSeconds ? (
            <span
              className={cn(
                "absolute right-2 bottom-2",
                VIDEO_CARD_TIME_BADGE_CLASS,
              )}
            >
              {formatDuration(previewing ? previewTime : asset.durationSeconds)}
            </span>
          ) : null}
        </>
      ) : asset.processingStatus === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
          <AlertCircleIcon className="size-5 text-destructive" />
          <span className="text-sm font-medium">Video could not be added</span>
          <span className="text-xs text-muted-foreground">
            {asset.processingError ?? "Processing failed"}
          </span>
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5">
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
              <span>Importing</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
