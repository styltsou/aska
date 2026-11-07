import { FolderIcon, PlayIcon, PlusIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, type CSSProperties } from "react";

import { ProgressiveImage } from "@/components/ui/progressive-image";
import { hasSelectionModifier } from "@/lib/selection";
import { cn } from "@/lib/utils";
import type { FolderAsset, FolderAssetPreview } from "@/types/asset";

import { LinkCardPreview } from "./link-asset-card";
import {
  COLOR_CARD_PREVIEW_ASPECT_RATIO,
  ColorCardPreview,
} from "./color-card-preview";
import { NoteMiniature } from "./note-miniature";
import {
  usePreviewStackLayout,
  PREVIEW_STACK_TRANSITION,
  type PreviewStackPose,
} from "./preview-stack-motion";

const MAX_VISIBLE_PREVIEWS = 4;

export function FolderAssetCard({
  asset,
  incomingAssetId,
  incomingAssetCount = 1,
  isDropTarget = false,
  onOpen,
  isContextMenuOpen = false,
  selected = false,
}: {
  asset: FolderAsset;
  incomingAssetId?: string;
  incomingAssetCount?: number;
  isDropTarget?: boolean;
  onOpen?: () => void;
  isContextMenuOpen?: boolean;
  selected?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [pointerOver, setPointerOver] = useState(false);
  const [stackInteracted, setStackInteracted] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = pointerOver || focused;
  const previews = asset.previews?.slice(0, MAX_VISIBLE_PREVIEWS) ?? [];
  const incomingPreviewIsReady =
    incomingAssetId !== undefined &&
    previews.some((preview) => preview.assetId === incomingAssetId);
  const showIncomingLayer = isDropTarget && !incomingPreviewIsReady;
  const { containerRef, poses } = usePreviewStackLayout(
    active,
    previews.map((preview) => preview.assetId).join(","),
  );

  return (
    <div
      className={cn(
        "group relative aspect-square cursor-pointer overflow-hidden rounded-lg border bg-sidebar text-sidebar-foreground transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        !selected && "hover:border-sidebar-foreground/20",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
      role={onOpen ? "link" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onMouseEnter={() => {
        setStackInteracted(true);
        setPointerOver(true);
      }}
      onMouseLeave={() => setPointerOver(false)}
      onFocus={(event) => {
        const visible = event.currentTarget.matches(":focus-visible");
        if (visible) setStackInteracted(true);
        setFocused(visible);
      }}
      onBlur={() => setFocused(false)}
      onClick={(event) => {
        if (!hasSelectionModifier(event)) onOpen?.();
      }}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onOpen();
      }}
    >
      <div
        ref={containerRef}
        aria-hidden="true"
        className="absolute inset-0"
        style={{ containerType: "size" }}
      >
        <div className="absolute inset-0">
          {previews.length === 0 ? <EmptyFolderPreview /> : null}
          {previews.map((preview, index) => (
            <FolderPreviewCard
              key={preview.assetId}
              preview={preview}
              index={index}
              count={previews.length}
              motionEnabled={stackInteracted}
              pose={poses[index]}
            />
          ))}
          <AnimatePresence initial={false}>
            {showIncomingLayer ? (
              <motion.div
                key="incoming-layer"
                className="absolute top-1/2 left-1/2 flex aspect-[4/3] w-[min(65%,11rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-dashed border-primary/60 bg-sidebar/95 text-primary shadow-sm backdrop-blur-sm"
                initial={
                  reduceMotion ? false : { opacity: 0, scale: 0.92, y: -8 }
                }
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.96, y: 6 }
                }
                transition={{
                  duration: reduceMotion ? 0 : 0.16,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ zIndex: MAX_VISIBLE_PREVIEWS + 1 }}
              >
                {incomingAssetCount > 1 ? (
                  <span className="text-sm font-semibold tabular-nums">
                    +{incomingAssetCount}
                  </span>
                ) : (
                  <PlusIcon className="size-6" strokeWidth={1.5} />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-linear-to-b from-sidebar/0 via-sidebar/85 to-sidebar px-3 pt-7 pb-2.5">
        <span className="min-w-0 truncate text-sm font-medium">
          {asset.name}
        </span>
        {asset.count !== undefined ? (
          <span className="ml-auto shrink-0 text-xs text-sidebar-foreground/55 tabular-nums">
            {asset.count}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyFolderPreview() {
  return (
    <div className="absolute top-1/2 left-1/2 flex aspect-[4/3] w-[min(65%,11rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-sidebar-foreground/10 bg-sidebar-foreground/2.5">
      <FolderIcon
        className="size-8 text-sidebar-foreground/20"
        strokeWidth={1.5}
      />
    </div>
  );
}

function FolderPreviewCard({
  preview,
  index,
  count,
  motionEnabled,
  pose,
}: {
  preview: FolderAssetPreview;
  index: number;
  count: number;
  motionEnabled: boolean;
  pose?: PreviewStackPose;
}) {
  const positionStyle: CSSProperties = {
    zIndex: count - index,
    translate: pose?.translate ?? "-50% -50%",
    rotate: pose?.rotate,
    transform: `scale(${pose?.scale ?? 1})`,
  };

  if ((preview.type === "image" || preview.type === "video") && preview.url) {
    return (
      <div
        data-preview-stack-card
        className={cn(
          "absolute top-1/2 left-1/2 w-max max-w-[65cqw] overflow-hidden rounded-lg",
          motionEnabled && PREVIEW_STACK_TRANSITION,
        )}
        style={positionStyle}
      >
        <img
          src={
            preview.blurDataURL && preview.width && preview.height
              ? preview.blurDataURL
              : preview.url
          }
          alt=""
          aria-hidden="true"
          width={preview.width}
          height={preview.height}
          loading="lazy"
          className="block h-auto max-h-[52cqh] w-auto max-w-[65cqw] opacity-0"
          style={
            preview.blurDataURL && preview.width && preview.height
              ? {
                  width: preview.width,
                  aspectRatio: `${preview.width} / ${preview.height}`,
                }
              : undefined
          }
        />
        <ProgressiveImage
          src={preview.displayUrl ?? preview.url}
          fallbackSrc={
            preview.type === "video" &&
            !preview.blurDataURL &&
            preview.displayUrl
              ? preview.url
              : undefined
          }
          fallbackClassName="scale-[1.03] blur-[5px] brightness-90 saturate-75"
          blurDataURL={preview.blurDataURL}
          alt=""
          width={preview.width}
          height={preview.height}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-fill"
        />
        {preview.type === "video" ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25">
              <PlayIcon className="ml-0.5 size-4 fill-current" />
            </span>
          </span>
        ) : null}
      </div>
    );
  }

  const ratio =
    preview.type === "color"
      ? COLOR_CARD_PREVIEW_ASPECT_RATIO
      : preview.type === "note"
        ? 0.82
        : 1;
  const style: CSSProperties = {
    ...positionStyle,
    width:
      preview.type === "link"
        ? "min(65cqw, 62cqh)"
        : `min(65cqw, ${ratio * 52}cqh)`,
    aspectRatio: preview.type === "link" ? undefined : ratio,
    maxHeight: "52cqh",
  };

  return (
    <div
      data-preview-stack-card
      className={cn(
        "absolute top-1/2 left-1/2 overflow-hidden rounded-lg border border-border bg-card",
        motionEnabled && PREVIEW_STACK_TRANSITION,
      )}
      style={style}
    >
      {preview.type === "link" ? (
        <LinkCardPreview preview={preview} variant="collection" />
      ) : preview.type === "color" ? (
        <ColorCardPreview
          hex={preview.hex}
          gradient={preview.gradient}
          title={preview.title}
          textScale={0.75}
        />
      ) : preview.type === "video" ? (
        <div className="flex size-full items-center justify-center bg-sidebar-foreground/5">
          <PlayIcon className="size-7 text-sidebar-foreground/30" />
        </div>
      ) : (
        <div className="relative size-full overflow-hidden bg-sidebar">
          <NoteMiniature
            content={preview.snippet ?? ""}
            title={preview.title}
            mentionColors={preview.mentionColors}
          />
        </div>
      )}
    </div>
  );
}
