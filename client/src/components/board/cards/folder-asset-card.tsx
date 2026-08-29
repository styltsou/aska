import { FolderIcon, Globe2Icon, PlusIcon } from "lucide-react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { cn } from "@/lib/utils";
import { hasSelectionModifier } from "@/lib/selection";
import type { FolderAsset } from "@/types/asset";

import { NoteMarkdown } from "./note-asset-card";

const previewTransition: Transition = {
  duration: 0.07,
  ease: [0.16, 1, 0.3, 1],
};

export function FolderAssetCard({
  asset,
  incomingAssetId,
  incomingAssetCount = 1,
  isDropTarget = false,
  onOpen,
  isContextMenuOpen = false,
}: {
  asset: FolderAsset;
  incomingAssetId?: string;
  incomingAssetCount?: number;
  isDropTarget?: boolean;
  onOpen?: () => void;
  isContextMenuOpen?: boolean;
}) {
  const previews = asset.previews ?? [];
  const hasPreviews = previews.length > 0;
  const incomingPreviewIsReady =
    incomingAssetId !== undefined &&
    previews.some((preview) => preview.assetId === incomingAssetId);
  const showDropSlot = isDropTarget && !incomingPreviewIsReady;
  const showPreviewGrid = hasPreviews || isDropTarget;
  const previewLayoutKey = JSON.stringify({
    showDropSlot,
    previewIds: previews.slice(0, 4).map((preview) => preview.assetId),
  });

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border bg-sidebar transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
      role={onOpen ? "link" : undefined}
      tabIndex={onOpen ? 0 : undefined}
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
      {showPreviewGrid ? (
        <div className="grid grid-cols-2 gap-3 p-3">
          <AnimatePresence initial={false} mode="popLayout">
            {Array.from({ length: 4 }).map((_, i) => {
              if (showDropSlot && i === 0) {
                return (
                  <motion.div
                    key={incomingAssetId ?? "drop-slot"}
                    layout="position"
                    layoutDependency={previewLayoutKey}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={previewTransition}
                    aria-hidden="true"
                    className="flex aspect-square items-center justify-center rounded-sm border border-dashed border-primary/50 bg-primary/8"
                  >
                    {incomingAssetCount > 1 ? (
                      <span className="text-xs font-semibold text-primary/80">
                        +{incomingAssetCount}
                      </span>
                    ) : (
                      <PlusIcon className="size-5 text-primary/70" />
                    )}
                  </motion.div>
                );
              }

              const previewIndex = showDropSlot ? i - 1 : i;
              const preview = previews[previewIndex];
              if (!preview) {
                return (
                  <motion.div
                    key={`placeholder-${i}`}
                    layout="position"
                    layoutDependency={previewLayoutKey}
                    transition={previewTransition}
                    className="aspect-square rounded-sm bg-sidebar"
                  />
                );
              }
              if (preview.type === "image" && preview.url) {
                return (
                  <motion.div
                    key={preview.assetId}
                    layout="position"
                    layoutDependency={previewLayoutKey}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={previewTransition}
                    className="aspect-square overflow-hidden rounded-sm ring-1 ring-sidebar-foreground/5"
                  >
                    <ProgressiveImage
                      src={preview.url}
                      blurDataURL={preview.blurDataURL}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </motion.div>
                );
              }
              if (preview.type === "link") {
                return (
                  <motion.div
                    key={preview.assetId}
                    layout="position"
                    layoutDependency={previewLayoutKey}
                    transition={previewTransition}
                    className="flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-sm bg-card p-2 text-center ring-1 ring-sidebar-foreground/5"
                  >
                    <Globe2Icon className="size-5 text-muted-foreground/60" />
                    <span className="max-w-full truncate text-[8px] text-muted-foreground">
                      {preview.hostname}
                    </span>
                  </motion.div>
                );
              }
              if (preview.type === "color") {
                return (
                  <motion.div
                    key={preview.assetId}
                    layout="position"
                    layoutDependency={previewLayoutKey}
                    transition={previewTransition}
                    className="aspect-square overflow-hidden rounded-sm ring-1 ring-sidebar-foreground/5"
                    style={{ backgroundColor: preview.hex }}
                  />
                );
              }
              return (
                <motion.div
                  key={preview.assetId}
                  layout="position"
                  layoutDependency={previewLayoutKey}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={previewTransition}
                  className={cn(
                    "ring-sidebar-foreground/5 flex aspect-square flex-col items-start justify-start gap-0.5 overflow-hidden rounded-sm p-2 ring-1",
                    !preview.color && "bg-card",
                  )}
                  style={
                    preview.color
                      ? { backgroundColor: preview.color }
                      : undefined
                  }
                >
                  <NoteMarkdown
                    content={preview.snippet ?? ""}
                    title={preview.title}
                    previewScale={0.5}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex items-center justify-center p-3">
          <div className="flex aspect-square w-full items-center justify-center rounded-sm bg-sidebar-foreground/2.5">
            <FolderIcon className="size-9 text-sidebar-foreground/10" />
          </div>
        </div>
      )}
      <div className="absolute right-px bottom-px left-px flex items-center gap-2 rounded-[calc(var(--radius)-1px)] border-t border-sidebar-foreground/10 bg-sidebar/85 px-3 py-2.5 backdrop-blur-sm transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] group-focus-within:bg-sidebar/60 group-hover:bg-sidebar/60">
        <FolderIcon className="size-4 shrink-0 text-sidebar-foreground" />
        <span className="truncate text-sm font-medium">{asset.name}</span>
        {asset.count !== undefined && (
          <span className="ml-auto text-xs text-sidebar-foreground/40">
            {asset.count}
          </span>
        )}
      </div>
    </div>
  );
}
