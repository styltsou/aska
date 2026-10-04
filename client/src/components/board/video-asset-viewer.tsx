import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LocateFixedIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import type { VideoAsset } from "@/types/asset";
import { AssetTimestampCard } from "@/components/board/asset-timestamp-card";
import { ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS } from "@/components/board/asset-viewer-control-styles";
import { NativeVideoPlayer } from "@/components/board/native-video-player";
import { useAssetFullscreenMorph } from "@/components/board/use-asset-fullscreen-morph";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiPatch, apiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { consumeVideoPlaybackPosition } from "@/lib/video-playback-position";

const VIDEO_VIEWER_LAYOUT_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};
const VIDEO_VIEWER_ICON_TRANSITION = {
  duration: 0.08,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function VideoAssetViewer({
  workspaceSlug,
  asset,
  open,
  loading = false,
  onClose,
  onDismissAll,
  onCloseComplete,
  onShowInBoard,
  initialPresentation,
  view,
  onViewChange,
  assetModalId,
  sharedEntry = false,
  sharedMorphing = false,
}: {
  workspaceSlug: string;
  asset?: VideoAsset;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onDismissAll?: () => void;
  onCloseComplete: () => void;
  onShowInBoard?: () => void;
  initialPresentation?: "fullscreen";
  view?: "modal" | "full";
  onViewChange?: (view: "modal" | "full") => void;
  assetModalId?: string;
  sharedEntry?: boolean;
  sharedMorphing?: boolean;
}) {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const [localExpanded, setLocalExpanded] = useState(
    initialPresentation === "fullscreen",
  );
  const [activeAsset, setActiveAsset] = useState<VideoAsset>();
  const [initialPlaybackTime] = useState(() => {
    const playbackAssetId = assetModalId ?? asset?.id;
    return playbackAssetId
      ? consumeVideoPlaybackPosition(playbackAssetId)
      : undefined;
  });

  useEffect(() => {
    if (asset) setActiveAsset(asset);
  }, [asset]);

  const displayedAsset = asset ?? (loading ? undefined : activeAsset);
  const expanded = view ? view === "full" : localExpanded;
  const presentation = expanded ? "fullscreen" : "modal";
  const {
    panelRef: fullscreenPanelRef,
    captureCurrentRect: captureFullscreenPanel,
  } = useAssetFullscreenMorph(
    Boolean(assetModalId) && open && !isMobile && !sharedMorphing,
    expanded,
  );
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : VIDEO_VIEWER_LAYOUT_TRANSITION;
  const accessibleTitle = displayedAsset?.title?.trim() || "Video";
  const accessibleDescription = displayedAsset
    ? `Watch ${accessibleTitle} without leaving Aska.`
    : "Loading video details.";
  const handleDownload = useCallback(() => {
    if (!displayedAsset) return;
    const link = document.createElement("a");
    link.href = apiUrl(
      `/api/v1/workspace/${encodeURIComponent(workspaceSlug)}/assets/${encodeURIComponent(displayedAsset.id)}/download`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [displayedAsset, workspaceSlug]);

  if (!displayedAsset && !loading) return null;

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(next, details) => {
          if (!next) {
            if (details.reason === "outside-press" && onDismissAll)
              onDismissAll();
            else onClose();
          }
        }}
        onOpenChangeComplete={(next) => !next && onCloseComplete()}
        swipeDirection="down"
        showSwipeHandle
        fast
      >
        <DrawerContent
          className="gap-0 overflow-hidden border-border/70 bg-background p-0 text-foreground shadow-2xl"
          style={
            {
              "--drawer-content-max-height":
                "calc(100dvh - var(--app-shell-inset))",
              "--bleed": "0px",
            } as CSSProperties
          }
        >
          <DrawerTitle className="sr-only">{accessibleTitle}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {accessibleDescription}
          </DrawerDescription>
          <NativeVideoToolbar
            asset={displayedAsset}
            onBack={onClose}
            onDismissAll={onDismissAll}
            onShowInBoard={onShowInBoard}
            onDownload={
              displayedAsset?.processingStatus === "completed" &&
              displayedAsset.url
                ? handleDownload
                : undefined
            }
            presentation="drawer"
          />
          {displayedAsset ? (
            <NativeVideoContent
              asset={displayedAsset}
              open={open}
              workspaceSlug={workspaceSlug}
              initialPlaybackTime={initialPlaybackTime}
            />
          ) : (
            <NativeVideoLoading />
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (!next) {
          if (details.reason === "outside-press" && onDismissAll)
            onDismissAll();
          else onClose();
        }
      }}
      onOpenChangeComplete={(next) => !next && onCloseComplete()}
    >
      <DialogContent
        ref={fullscreenPanelRef}
        data-workspace-asset-modal={assetModalId}
        data-canvas-shared-entry={sharedEntry || undefined}
        showCloseButton={false}
        overlayClassName={cn(
          assetModalId && "workspace-asset-view-backdrop",
          sharedEntry && "canvas-shared-entry",
        )}
        render={
          <motion.div
            layout={!sharedMorphing && !assetModalId}
            layoutDependency={presentation}
            initial={
              reduceMotion || sharedEntry ? false : { opacity: 0, scale: 0.96 }
            }
            animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.96 }}
            transition={{
              layout: layoutTransition,
              opacity:
                reduceMotion || (sharedEntry && open)
                  ? { duration: 0 }
                  : {
                      duration: open ? 0.25 : 0.15,
                      ease: [0.22, 1, 0.36, 1],
                    },
              scale:
                reduceMotion || (sharedEntry && open)
                  ? { duration: 0 }
                  : {
                      duration: open ? 0.25 : 0.15,
                      ease: [0.22, 1, 0.36, 1],
                    },
            }}
            style={{ transformOrigin: "center center" }}
          />
        }
        className={cn(
          "flex min-h-0 max-h-[calc(100svh-2rem)] flex-col overflow-hidden transition-[background-color,box-shadow,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          expanded
            ? "top-0 left-0 h-dvh max-h-dvh w-dvw max-w-none translate-x-0 translate-y-0 rounded-none bg-background shadow-none ring-1 ring-transparent"
            : "top-1/2 h-[min(48rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[76rem] -translate-y-1/2 rounded-xl bg-popover/80 shadow-2xl ring-1 ring-foreground/10",
        )}
      >
        <DialogTitle className="sr-only">{accessibleTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          {accessibleDescription}
        </DialogDescription>
        <NativeVideoToolbar
          asset={displayedAsset}
          onBack={onClose}
          onDismissAll={onDismissAll}
          onShowInBoard={onShowInBoard}
          onDownload={
            displayedAsset?.processingStatus === "completed" &&
            displayedAsset.url
              ? handleDownload
              : undefined
          }
          expanded={expanded}
          presentation={expanded ? "workspace" : "modal"}
          layoutDependency={presentation}
          disableLayout={sharedMorphing || Boolean(assetModalId)}
          fullscreenMorphDuration={
            assetModalId ? (expanded ? "400ms" : "350ms") : undefined
          }
          onToggleExpanded={() => {
            captureFullscreenPanel();
            if (onViewChange) onViewChange(expanded ? "modal" : "full");
            else setLocalExpanded((current) => !current);
          }}
        />
        <DialogBody
          className={cn(
            "min-h-0 flex-1 overflow-hidden border-t border-b-0 bg-background p-0 transition-[border-color,border-radius] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            assetModalId
              ? expanded
                ? "duration-[400ms]"
                : "duration-[350ms]"
              : "duration-[180ms]",
            expanded
              ? "rounded-none border-transparent"
              : "rounded-t-xl rounded-b-none border-border",
          )}
        >
          {displayedAsset ? (
            <NativeVideoContent
              key={displayedAsset.id}
              asset={displayedAsset}
              open={open}
              workspaceSlug={workspaceSlug}
              workspace={expanded}
              animateLayout={!sharedMorphing && !assetModalId}
              layoutDependency={presentation}
              initialPlaybackTime={initialPlaybackTime}
              viewer
            />
          ) : (
            <NativeVideoLoading workspace={expanded} viewer />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function NativeVideoToolbar({
  asset,
  onBack,
  onDismissAll,
  onShowInBoard,
  onDownload,
  expanded,
  presentation,
  layoutDependency,
  disableLayout = false,
  fullscreenMorphDuration,
  onToggleExpanded,
}: {
  asset?: VideoAsset;
  onBack: () => void;
  onDismissAll?: () => void;
  onShowInBoard?: () => void;
  onDownload?: () => void;
  expanded?: boolean;
  presentation: "drawer" | "modal" | "workspace";
  layoutDependency?: string;
  disableLayout?: boolean;
  fullscreenMorphDuration?: "400ms" | "350ms";
  onToggleExpanded?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const animateLayout = presentation !== "drawer" && !disableLayout;
  const iconButtonClass = cn(
    "size-8 rounded-lg",
    ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
  );

  return (
    <motion.div
      layout={animateLayout}
      layoutDependency={layoutDependency ?? presentation}
      transition={{
        layout: reduceMotion ? { duration: 0 } : VIDEO_VIEWER_LAYOUT_TRANSITION,
      }}
      className={cn(
        "relative z-20 flex shrink-0 items-center gap-0.5 p-2 transition-[margin,padding,background-color,border-color,border-radius] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        fullscreenMorphDuration === "400ms"
          ? "duration-[400ms]"
          : fullscreenMorphDuration === "350ms"
            ? "duration-[350ms]"
            : "duration-[180ms]",
        presentation === "modal" &&
          "rounded-t-xl rounded-b-none bg-transparent",
        presentation === "workspace" &&
          "mt-[var(--app-shell-inset)] mb-[var(--app-shell-inset)] rounded-none bg-background pl-[calc(var(--app-shell-inset)+0.5rem)]",
        presentation === "drawer" && "border-b bg-background",
      )}
    >
      <ToolbarButton
        label="Back"
        onClick={onBack}
        className={iconButtonClass}
        shortcut={
          <KbdGroup className="gap-0.5">
            <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
          </KbdGroup>
        }
      >
        <ArrowLeftIcon className="size-4" />
      </ToolbarButton>
      {onDismissAll ? (
        <ToolbarButton
          label="Close all to board"
          onClick={onDismissAll}
          className={iconButtonClass}
        >
          <XIcon className="size-4" />
        </ToolbarButton>
      ) : null}
      {onShowInBoard ? (
        <ToolbarButton
          label="Show in board"
          onClick={onShowInBoard}
          className={iconButtonClass}
        >
          <LocateFixedIcon className="size-4" />
        </ToolbarButton>
      ) : null}
      {onToggleExpanded ? (
        <ToolbarButton
          label={expanded ? "Return to modal" : "Expand video"}
          onClick={onToggleExpanded}
          className={iconButtonClass}
        >
          <span className="relative size-4">
            <AnimatePresence initial={false}>
              <motion.span
                key={expanded ? "collapse" : "expand"}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                transition={
                  reduceMotion ? { duration: 0 } : VIDEO_VIEWER_ICON_TRANSITION
                }
                className="absolute inset-0"
              >
                {expanded ? (
                  <Minimize2Icon className="size-4" />
                ) : (
                  <Maximize2Icon className="size-4" />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </ToolbarButton>
      ) : null}
      <div className="ml-auto flex items-center gap-0.5">
        {asset?.sourceUrl ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={asset.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center justify-center",
                    iconButtonClass,
                  )}
                  aria-label="Open source"
                />
              }
            >
              <ExternalLinkIcon className="size-4" />
              <span className="sr-only">Open source</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Open source</TooltipContent>
          </Tooltip>
        ) : null}
        {onDownload ? (
          <ToolbarButton
            label="Download original"
            onClick={onDownload}
            className={iconButtonClass}
          >
            <DownloadIcon className="size-4" />
          </ToolbarButton>
        ) : null}
        {asset ? (
          <AssetTimestampCard
            createdAt={asset.createdAt}
            updatedAt={asset.updatedAt}
            label="Video details"
            triggerClassName={ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS}
          />
        ) : null}
      </div>
    </motion.div>
  );
}

function ToolbarButton({
  label,
  onClick,
  className,
  shortcut,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  shortcut?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={className}
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut}
      </TooltipContent>
    </Tooltip>
  );
}

function NativeVideoContent({
  asset,
  open,
  workspaceSlug,
  workspace = false,
  animateLayout = false,
  layoutDependency,
  initialPlaybackTime,
  viewer = false,
}: {
  asset: VideoAsset;
  open: boolean;
  workspaceSlug: string;
  workspace?: boolean;
  animateLayout?: boolean;
  layoutDependency?: string;
  initialPlaybackTime?: number;
  viewer?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(asset.note ?? "");
  const [saving, setSaving] = useState(false);
  const ready = asset.processingStatus === "completed" && Boolean(asset.url);
  const ratio =
    asset.width && asset.height ? asset.width / asset.height : 16 / 9;
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : VIDEO_VIEWER_LAYOUT_TRANSITION;

  useEffect(() => setNote(asset.note ?? ""), [asset.id, asset.note]);

  const save = async () => {
    setSaving(true);
    try {
      await apiPatch(
        `/api/v1/workspace/${encodeURIComponent(workspaceSlug)}/assets/${encodeURIComponent(asset.id)}/video`,
        { note: note.trim() || null },
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["workspace-asset", workspaceSlug, asset.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["collectionContents", workspaceSlug],
        }),
        queryClient.invalidateQueries({
          queryKey: ["inboxContents", workspaceSlug],
        }),
      ]);
      toast.success("Video note saved");
    } catch {
      toast.error("Could not save video note");
    } finally {
      setSaving(false);
    }
  };

  const media = (
    <motion.div
      data-asset-modal-hero={viewer || undefined}
      layout={animateLayout}
      layoutDependency={layoutDependency ?? workspace}
      transition={{ layout: layoutTransition }}
      className="relative isolate flex w-full shrink-0 items-center justify-center overflow-hidden rounded-md bg-black"
      style={{
        aspectRatio: `${ratio}`,
        maxWidth: workspace
          ? `min(100%, calc((100dvh - 9rem) * ${ratio}))`
          : `min(100%, calc((100dvh - 12rem) * ${ratio}))`,
      }}
    >
      {ready && open ? (
        <NativeVideoPlayer
          key={asset.id}
          src={asset.url!}
          poster={asset.posterUrl ?? undefined}
          storyboard={asset.storyboard}
          title={asset.title?.trim() || "Untitled video"}
          initialTime={initialPlaybackTime}
          continuePlaying={initialPlaybackTime !== undefined}
        />
      ) : asset.processingStatus === "failed" ? (
        <div className="px-6 text-center text-sm text-white/70">
          {asset.processingError ?? "Video processing failed"}
        </div>
      ) : (
        <div className="text-sm text-white/70">Importing video…</div>
      )}
    </motion.div>
  );

  const metadata = (
    <div className="space-y-1">
      <h2 className="font-heading text-lg leading-snug font-medium text-balance sm:text-xl">
        {asset.title?.trim() || "Untitled video"}
      </h2>
      {asset.sourceLabel ? (
        <p className="text-sm text-muted-foreground">{asset.sourceLabel}</p>
      ) : null}
      <div className="pt-3">
        <label
          htmlFor={`video-note-${asset.id}`}
          className="text-xs font-medium text-muted-foreground"
        >
          Notes
        </label>
        <AutoResizeTextarea
          id={`video-note-${asset.id}`}
          spellCheck={false}
          value={note}
          maxLength={10_000}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note"
          rows={1}
          className="mt-1 block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
        />
        {note.trim() !== (asset.note ?? "").trim() ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save note"}
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (viewer) {
    return (
      <motion.div
        layout={animateLayout}
        layoutDependency={layoutDependency ?? workspace}
        transition={{ layout: layoutTransition }}
        className="relative flex h-full min-h-0 flex-1 overflow-hidden"
      >
        <ScrollArea className="h-full min-h-0 w-full [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-3 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-1 [&_[data-slot=scroll-area-thumb]]:w-1.5 [&_[data-slot=scroll-area-thumb]]:bg-foreground/35">
          <div className="min-h-full bg-background">
            <div className="mx-auto w-full max-w-[76rem] px-5">
              <div className="flex items-center justify-center pt-4 pb-8">
                {media}
              </div>
              <div className="pb-5">{metadata}</div>
            </div>
          </div>
        </ScrollArea>
      </motion.div>
    );
  }

  return (
    <ScrollArea className="h-full min-h-0 w-full">
      <div className="space-y-5 p-3 sm:p-4">
        <div className="flex justify-center">{media}</div>
        {metadata}
      </div>
    </ScrollArea>
  );
}

function NativeVideoLoading({
  workspace = false,
  viewer = false,
}: {
  workspace?: boolean;
  viewer?: boolean;
}) {
  const content = (
    <div className="mx-auto w-full max-w-[76rem] px-5" aria-hidden="true">
      <div className="flex justify-center pt-4 pb-8">
        <Skeleton
          data-asset-modal-hero
          className={cn(
            "aspect-video w-full rounded-md",
            workspace ? "max-w-none" : "max-w-[calc((100dvh-5rem)*16/9)]",
          )}
        />
      </div>
      <div className="space-y-3 pb-5">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-5 h-3 w-12" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );

  if (!viewer) {
    return (
      <div
        className="p-3 sm:p-4"
        role="status"
        aria-label="Loading video details"
      >
        {content}
      </div>
    );
  }

  return (
    <ScrollArea
      className="h-full min-h-0 w-full"
      role="status"
      aria-label="Loading video details"
    >
      {content}
    </ScrollArea>
  );
}
