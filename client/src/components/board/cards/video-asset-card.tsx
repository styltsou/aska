import { AlertCircleIcon, LoaderCircleIcon, PlayIcon } from "lucide-react";

import type { VideoAsset } from "@/types/asset";
import { hasSelectionModifier } from "@/lib/selection";

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
}: {
  asset: VideoAsset;
  onOpen?: () => void;
}) {
  const ready = asset.processingStatus === "completed" && !!asset.url;
  return (
    <div
      data-asset-card-surface
      className="group relative overflow-hidden rounded-lg bg-sidebar-foreground/8"
      style={{
        aspectRatio:
          asset.width && asset.height
            ? `${asset.width} / ${asset.height}`
            : "16 / 9",
      }}
      role={ready && onOpen ? "button" : undefined}
      tabIndex={ready && onOpen ? 0 : undefined}
      onClick={(event) => {
        if (!hasSelectionModifier(event) && ready) onOpen?.();
      }}
      onKeyDown={(event) => {
        if (ready && onOpen && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {asset.posterUrl ? (
        <img
          src={asset.posterUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {ready ? (
        <>
          <span className="absolute top-1/2 left-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white transition-transform group-hover:scale-110">
            <PlayIcon className="ml-0.5 size-5 fill-current" />
          </span>
          {asset.durationSeconds ? (
            <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
              {formatDuration(asset.durationSeconds)}
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
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" /> Processing video…
        </div>
      )}
    </div>
  );
}
