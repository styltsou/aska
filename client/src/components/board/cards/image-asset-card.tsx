import { motion, useReducedMotion } from "motion/react";
import { ExternalLink, LoaderCircleIcon } from "lucide-react";
import {
  getImageViewerLayoutId,
  IMAGE_VIEWER_TRANSITION,
  useActiveImageViewer,
} from "@/components/board/image-viewer-transition";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import type { ImageAsset } from "@/types/asset";
import { hasSelectionModifier } from "@/lib/selection";
import { cn } from "@/lib/utils";

export function ImageAssetCard({
  asset,
  onOpen,
  isContextMenuOpen = false,
}: {
  asset: ImageAsset;
  onOpen?: () => void;
  isContextMenuOpen?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const activeViewerAssetId = useActiveImageViewer();
  const imageIsInViewer = activeViewerAssetId === asset.id;
  const hasBar = asset.sourceLabel;

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border border-transparent transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-foreground/20",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
      onDoubleClick={(event) => {
        if (!hasSelectionModifier(event)) {
          onOpen?.();
        }
      }}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onOpen();
      }}
    >
      {!imageIsInViewer ? (
        <motion.div
          layoutId={
            onOpen && !shouldReduceMotion
              ? getImageViewerLayoutId(asset.id)
              : undefined
          }
          transition={IMAGE_VIEWER_TRANSITION}
          className="absolute inset-0 overflow-hidden rounded-[6px]"
        >
          <ProgressiveImage
            src={asset.url}
            fallbackSrc={asset.localPreviewUrl}
            blurDataURL={asset.uploadStatus ? undefined : asset.blurDataURL}
            alt={asset.alt ?? ""}
            className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
            loading="lazy"
          />
        </motion.div>
      ) : null}
      {asset.uploadStatus ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-popover/85 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
            <LoaderCircleIcon className="size-3 animate-spin" />
            {asset.uploadStatus === "processing" ? (
              <span>Importing</span>
            ) : (
              <span>
                Uploading{" "}
                <span className="font-mono tabular-nums">
                  {asset.uploadProgress ?? 0}%
                </span>
              </span>
            )}
          </div>
        </div>
      ) : null}
      {hasBar && !asset.uploadStatus ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-full justify-center px-2.5 pb-2.5 opacity-0 transition-[translate,opacity] duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none">
          <div className="group/pill inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-sidebar-foreground/10 bg-sidebar/60 px-3 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sidebar/90 hover:ring-sidebar-foreground/25">
            <a
              href={asset.sourceUrl ?? asset.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex min-w-0 items-center gap-1"
            >
              <ExternalLink className="size-3 shrink-0" />
              <span className="truncate">{asset.sourceLabel}</span>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
