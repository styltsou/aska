import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  LocateFixedIcon,
  Maximize2Icon,
  Minimize2Icon,
  PanelRightIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";

import { useUpdateLink } from "@/api/collection";
import { useQueryClient } from "@tanstack/react-query";
import {
  AssetTimestampCard,
  hasAssetBeenEdited,
} from "@/components/board/asset-timestamp-card";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspacePeek } from "@/components/app-shell/workspace-peek";
import type { AssetLocation } from "@/api/collection";
import { matchesKeybinding, PEEK_ASSET_SHORTCUT } from "@/lib/keybindings";
import { formatNoteHeaderEditTime } from "@/lib/note-date-format";
import { getPlatformAlt, getPlatformShift } from "@/lib/platform";
import { cn } from "@/lib/utils";
import type { LinkAsset } from "@/types/asset";

type VideoLinkAsset = LinkAsset & { video: NonNullable<LinkAsset["video"]> };

const LINK_NOTE_AUTOSAVE_DELAY_MS = 350;
const LINK_NOTE_STORAGE_KEY = "aska:link-note:v1:";
const VIDEO_VIEWER_LAYOUT_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};
const VIDEO_VIEWER_ICON_TRANSITION = {
  duration: 0.08,
  ease: [0.22, 1, 0.36, 1] as const,
};
const VIDEO_VIEWER_DESCRIPTION_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};
const FULLSCREEN_TOOLBAR_CHROME_REM = 3;
const FULLSCREEN_MEDIA_PADDING_TOP_REM = 1;
const FULLSCREEN_MEDIA_PADDING_BOTTOM_REM = 2;
const FULLSCREEN_MEDIA_PADDING_X_REM = 1.25;
const FULLSCREEN_MEDIA_MAX_WIDTH = `calc((100dvh - var(--app-shell-inset) * 2 - ${FULLSCREEN_TOOLBAR_CHROME_REM + FULLSCREEN_MEDIA_PADDING_TOP_REM + FULLSCREEN_MEDIA_PADDING_BOTTOM_REM}rem) * 16 / 9)`;
const FULLSCREEN_COLUMN_MAX_WIDTH = `calc(${FULLSCREEN_MEDIA_MAX_WIDTH} + ${FULLSCREEN_MEDIA_PADDING_X_REM * 2}rem)`;

function linkNoteStorageKey(workspaceSlug: string, assetId: string) {
  return `${LINK_NOTE_STORAGE_KEY}${JSON.stringify([workspaceSlug, assetId])}`;
}

function readLinkNoteDraft(
  workspaceSlug: string,
  assetId: string,
): string | undefined {
  try {
    return (
      window.localStorage.getItem(linkNoteStorageKey(workspaceSlug, assetId)) ??
      undefined
    );
  } catch {
    return undefined;
  }
}

function saveLinkNoteDraft(
  workspaceSlug: string,
  assetId: string,
  note: string,
) {
  try {
    window.localStorage.setItem(
      linkNoteStorageKey(workspaceSlug, assetId),
      note,
    );
  } catch {
    // Recovery is best effort when storage is unavailable.
  }
}

function clearLinkNoteDraft(workspaceSlug: string, assetId: string) {
  try {
    window.localStorage.removeItem(linkNoteStorageKey(workspaceSlug, assetId));
  } catch {
    // Recovery cleanup is best effort when storage is unavailable.
  }
}

export function YouTubeVideoViewer({
  asset,
  open: controlledOpen,
  loading = false,
  onClose,
  onCloseComplete,
  onShowInBoard,
  initialPresentation,
  workspaceSlug,
  location,
}: {
  asset?: LinkAsset;
  open?: boolean;
  loading?: boolean;
  onClose: () => void;
  onCloseComplete?: () => void;
  onShowInBoard?: () => void;
  initialPresentation?: "fullscreen";
  workspaceSlug: string;
  location?: AssetLocation;
}) {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const { target: peekTarget, peekVideo } = useWorkspacePeek();
  const [expanded, setExpanded] = useState(
    initialPresentation === "fullscreen",
  );
  const [activeAsset, setActiveAsset] = useState<VideoLinkAsset>();

  useEffect(() => {
    if (isVideoLinkAsset(asset)) setActiveAsset(asset);
  }, [asset]);

  const displayedAsset = isVideoLinkAsset(asset)
    ? asset
    : loading
      ? undefined
      : activeAsset;
  if (!displayedAsset && !loading) return null;
  const open = controlledOpen ?? asset !== undefined;
  const split = Boolean(peekTarget) && !isMobile;
  const presentation = split ? "split" : expanded ? "fullscreen" : "modal";
  const workspace = presentation !== "modal";
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : VIDEO_VIEWER_LAYOUT_TRANSITION;
  const accessibleDescription = displayedAsset
    ? `Watch ${displayedAsset.title} without leaving Aska.`
    : "Loading video details.";

  useEffect(() => {
    if (!open || !displayedAsset || !location || isMobile) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !matchesKeybinding(event, PEEK_ASSET_SHORTCUT)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      peekVideo(displayedAsset, location);
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayedAsset, isMobile, location, onClose, open, peekVideo]);

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(next) => !next && onClose()}
        onOpenChangeComplete={(next) => !next && onCloseComplete?.()}
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
          <DrawerTitle className="sr-only">
            {displayedAsset?.title ?? "Loading video"}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {accessibleDescription}
          </DrawerDescription>
          <VideoViewerToolbar
            onBack={onClose}
            onShowInBoard={onShowInBoard}
            presentation="drawer"
          />
          {displayedAsset ? (
            <YouTubeVideoContent
              key={displayedAsset.video.videoId}
              asset={displayedAsset}
              open={open}
              workspaceSlug={workspaceSlug}
            />
          ) : (
            <VideoViewerLoading />
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      modal={!split}
      onOpenChange={(next) => !next && onClose()}
      onOpenChangeComplete={(next) => !next && onCloseComplete?.()}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName={split ? "hidden" : undefined}
        render={
          <motion.div
            layout
            layoutDependency={presentation}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.96 }}
            transition={{
              layout: layoutTransition,
              opacity: reduceMotion
                ? { duration: 0 }
                : { duration: open ? 0.25 : 0.15, ease: [0.22, 1, 0.36, 1] },
              scale: reduceMotion
                ? { duration: 0 }
                : { duration: open ? 0.25 : 0.15, ease: [0.22, 1, 0.36, 1] },
            }}
            style={{ transformOrigin: "center center" }}
          />
        }
        className={cn(
          "flex min-h-0 max-h-[calc(100svh-2rem)] flex-col overflow-hidden transition-[background-color,box-shadow,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          workspace
            ? "top-0 left-0 h-dvh max-h-dvh w-dvw max-w-none translate-x-0 translate-y-0 rounded-none bg-background shadow-none ring-1 ring-transparent"
            : "top-1/2 h-[min(48rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[76rem] -translate-y-1/2 rounded-xl bg-popover/80 shadow-2xl ring-1 ring-foreground/10",
          split &&
            "z-50 w-[calc(100dvw-var(--workspace-peek-rail-width)-var(--workspace-peek-stage-gap)-var(--workspace-peek-stage-gap))]",
        )}
      >
        <DialogTitle className="sr-only">
          {displayedAsset?.title ?? "Loading video"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {accessibleDescription}
        </DialogDescription>
        <VideoViewerToolbar
          onBack={onClose}
          onPeek={
            displayedAsset && location
              ? () => {
                  peekVideo(displayedAsset, location);
                  onClose();
                }
              : undefined
          }
          onShowInBoard={onShowInBoard}
          expanded={workspace}
          presentation={workspace ? "workspace" : "modal"}
          layoutDependency={presentation}
          onToggleExpanded={
            split ? undefined : () => setExpanded((current) => !current)
          }
        />
        <DialogBody
          className={cn(
            "min-h-0 flex-1 overflow-hidden border-t border-b-0 bg-background p-0 transition-[border-color,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            workspace
              ? "rounded-none border-transparent"
              : "rounded-t-xl rounded-b-none border-border",
          )}
        >
          {displayedAsset ? (
            <YouTubeVideoContent
              key={displayedAsset.video.videoId}
              asset={displayedAsset}
              open={open}
              workspaceSlug={workspaceSlug}
              workspace={workspace}
              animateLayout
              layoutDependency={presentation}
              largeMetadata={presentation === "fullscreen"}
              viewer
            />
          ) : (
            <VideoViewerLoading />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function VideoViewerToolbar({
  onBack,
  onPeek,
  onShowInBoard,
  expanded,
  presentation,
  layoutDependency,
  onToggleExpanded,
}: {
  onBack: () => void;
  onPeek?: () => void;
  onShowInBoard?: () => void;
  expanded?: boolean;
  presentation: "drawer" | "modal" | "workspace";
  layoutDependency?: string;
  onToggleExpanded?: () => void;
}) {
  const backLabel = "Back to board";
  const reduceMotion = useReducedMotion();
  const animateLayout = presentation !== "drawer";

  return (
    <motion.div
      layout={animateLayout}
      layoutDependency={layoutDependency ?? presentation}
      transition={{
        layout: reduceMotion ? { duration: 0 } : VIDEO_VIEWER_LAYOUT_TRANSITION,
      }}
      className={cn(
        "relative z-20 flex shrink-0 items-center gap-0.5 p-2 transition-[background-color,border-color,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        presentation === "modal" &&
          "rounded-t-xl rounded-b-none bg-transparent",
        presentation === "workspace" &&
          "mt-[var(--app-shell-inset)] mb-[var(--app-shell-inset)] rounded-none bg-background pl-[calc(var(--app-shell-inset)+0.5rem)]",
        presentation === "drawer" && "border-b bg-background",
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label={backLabel}
              onClick={onBack}
            />
          }
        >
          <ArrowLeftIcon className="size-4" />
          <span className="sr-only">{backLabel}</span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span>{backLabel}</span>
          <KbdGroup className="gap-0.5">
            <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
      {onPeek ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                aria-label="Peek video"
                onClick={onPeek}
              />
            }
          >
            <PanelRightIcon className="size-4" />
            <span className="sr-only">Peek video</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <span>Peek video</span>
            <KbdGroup className="gap-0.5">
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                {getPlatformAlt()}
              </Kbd>
              <span>+</span>
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                {getPlatformShift()}
              </Kbd>
              <span>+</span>
              <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">P</Kbd>
            </KbdGroup>
          </TooltipContent>
        </Tooltip>
      ) : null}
      {onShowInBoard ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                aria-label="Show in board"
                onClick={onShowInBoard}
              />
            }
          >
            <LocateFixedIcon className="size-4" />
            <span className="sr-only">Show in board</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Show in board</TooltipContent>
        </Tooltip>
      ) : null}
      {onToggleExpanded ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg"
                aria-label={expanded ? "Return to modal" : "Expand video"}
                onClick={onToggleExpanded}
              />
            }
          >
            <span className="relative size-4">
              <AnimatePresence initial={false}>
                <motion.span
                  key={expanded ? "collapse" : "expand"}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : VIDEO_VIEWER_ICON_TRANSITION
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
            <span className="sr-only">
              {expanded ? "Return to modal" : "Expand video"}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {expanded ? "Return to modal" : "Expand video"}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </motion.div>
  );
}

function VideoViewerLoading() {
  return (
    <div className="space-y-4 p-3 sm:p-4">
      <Skeleton className="aspect-video w-full rounded-md" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-36" />
    </div>
  );
}

export function YouTubeVideoContent({
  asset,
  open,
  workspaceSlug,
  compact = false,
  workspace = false,
  animateLayout = false,
  layoutDependency,
  largeMetadata = false,
  viewer = false,
}: {
  asset: VideoLinkAsset;
  open: boolean;
  workspaceSlug: string;
  compact?: boolean;
  workspace?: boolean;
  animateLayout?: boolean;
  layoutDependency?: string;
  largeMetadata?: boolean;
  viewer?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [playerLoaded, setPlayerLoaded] = useState(false);
  const embedUrl = youtubeEmbedUrl(asset.video.videoId);
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : VIDEO_VIEWER_LAYOUT_TRANSITION;

  const media = (
    <motion.div
      layout={animateLayout}
      layoutDependency={layoutDependency ?? workspace}
      transition={{ layout: layoutTransition }}
      className={cn(
        "relative isolate aspect-video shrink-0 overflow-hidden rounded-md bg-background",
        viewer ? "w-full max-w-[calc((100dvh-5rem)*16/9)]" : "m-2 sm:m-3",
        workspace && viewer && "max-w-none",
        workspace &&
          !viewer &&
          "w-[calc(100%-1.5rem)] max-w-[calc((100dvh-13rem)*16/9)] self-center",
      )}
    >
      {asset.previewImage ? (
        <>
          <img
            src={asset.previewImage.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl saturate-125"
          />
          <img
            src={asset.previewImage.url}
            alt=""
            aria-hidden="true"
            className={cn(
              "absolute inset-0 size-full scale-105 object-cover blur-md transition-[filter,opacity] duration-300 motion-reduce:transition-none",
              playerLoaded ? "opacity-0" : "opacity-100",
            )}
          />
        </>
      ) : null}

      {open ? (
        <iframe
          src={embedUrl}
          title={asset.title}
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          onLoad={() => setPlayerLoaded(true)}
          className={cn(
            "absolute inset-0 block size-full rounded-md border-none outline-none ring-0 transition-opacity duration-300 motion-reduce:transition-none",
            playerLoaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </motion.div>
  );

  const metadata = (
    <VideoViewerMetadata
      asset={asset}
      compact={compact}
      large={largeMetadata}
    />
  );

  if (viewer) {
    return (
      <motion.div
        layout={animateLayout}
        layoutDependency={layoutDependency ?? workspace}
        transition={{ layout: layoutTransition }}
        className="relative flex h-full min-h-0 flex-1 overflow-hidden"
      >
        <ScrollArea className="h-full min-h-0 w-full [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-3 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-1 [&_[data-slot=scroll-area-thumb]]:w-1.5 [&_[data-slot=scroll-area-thumb]]:bg-foreground/35 [&_[data-slot=scroll-area-thumb]]:backdrop-blur-sm">
          <div className="min-h-full bg-background">
            <div
              className="mx-auto w-full px-5"
              style={
                workspace
                  ? { maxWidth: FULLSCREEN_COLUMN_MAX_WIDTH }
                  : undefined
              }
            >
              <div className="flex items-center justify-start pt-4 pb-8">
                {media}
              </div>
              <div className="space-y-1 pb-5">
                {metadata}
                <VideoLinkNoteEditor
                  asset={asset}
                  open={open}
                  workspaceSlug={workspaceSlug}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout={animateLayout}
      layoutDependency={layoutDependency ?? workspace}
      transition={{ layout: layoutTransition }}
      className="relative flex min-h-0 flex-col"
    >
      {media}
      <div
        className={cn(
          "space-y-1 bg-background px-4 pb-4 sm:px-5 sm:pb-5",
          compact && "px-4! sm:px-4!",
        )}
      >
        {metadata}
        <VideoLinkNoteEditor
          asset={asset}
          open={open}
          workspaceSlug={workspaceSlug}
        />
      </div>
    </motion.div>
  );
}

function VideoViewerMetadata({
  asset,
  compact,
  large,
}: {
  asset: VideoLinkAsset;
  compact: boolean;
  large: boolean;
}) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  // The clamp is only reapplied once the collapse animation settles, otherwise
  // the text would snap to three lines while its box is still animating down.
  const [descriptionClamped, setDescriptionClamped] = useState(true);
  const reduceMotion = useReducedMotion();
  const title =
    asset.title === asset.hostname ? "Title unavailable" : asset.title;
  const channelName = asset.video.channelName ?? "Channel unavailable";
  const description = asset.description?.trim();
  const descriptionIsLong = Boolean(
    description &&
    (description.length > 240 || description.split("\n").length > 3),
  );
  const descriptionUnavailable =
    !description &&
    asset.resolutionStatus !== "queued" &&
    asset.resolutionStatus !== "resolving";
  const [descriptionElement, setDescriptionElement] =
    useState<HTMLParagraphElement | null>(null);
  const [descriptionHeights, setDescriptionHeights] = useState<{
    collapsed: number;
    expanded: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!descriptionElement || !descriptionIsLong) {
      return;
    }
    const measure = () => {
      // A clamped element reports its clipped height, so read the expanded
      // height with the clamp lifted (an inline `display: block` is enough,
      // since `-webkit-line-clamp` only applies to `-webkit-box`).
      const previousDisplay = descriptionElement.style.display;
      descriptionElement.style.display = "block";
      const expandedHeight = descriptionElement.offsetHeight;
      descriptionElement.style.display = previousDisplay;
      const lineHeight = Number.parseFloat(
        getComputedStyle(descriptionElement).lineHeight,
      );
      // The collapsed state is a three-line clamp, which lays out as exactly
      // three line boxes unless the description is shorter than that.
      const collapsedHeight = Number.isNaN(lineHeight)
        ? expandedHeight
        : Math.min(expandedHeight, lineHeight * 3);
      setDescriptionHeights((current) =>
        current?.collapsed === collapsedHeight &&
        current.expanded === expandedHeight
          ? current
          : { collapsed: collapsedHeight, expanded: expandedHeight },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(descriptionElement);
    return () => observer.disconnect();
  }, [descriptionElement, description, descriptionIsLong, large, compact]);

  const descriptionParagraph = description ? (
    <p
      ref={setDescriptionElement}
      className={cn(
        "whitespace-pre-line text-sm leading-relaxed text-pretty text-muted-foreground",
        large && "text-base! leading-7!",
        descriptionIsLong && descriptionClamped && "line-clamp-3",
      )}
    >
      {description}
    </p>
  ) : null;

  return (
    <div className="space-y-1">
      <h2
        className={cn(
          "font-heading text-lg leading-snug font-medium text-balance sm:text-xl",
          large && "text-2xl! leading-tight!",
          compact && "text-lg!",
        )}
      >
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-x-1.5 pt-0.5">
        {asset.video.channelName && asset.video.channelUrl ? (
          <a
            href={asset.video.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
              large && "text-base!",
            )}
          >
            {channelName}
            <ExternalLinkIcon className={cn("size-3.5", large && "size-4!")} />
            <span className="sr-only">Opens channel in a new tab</span>
          </a>
        ) : (
          <p
            className={cn(
              "text-sm font-medium text-muted-foreground",
              large && "text-base!",
            )}
          >
            {channelName}
          </p>
        )}
        <AssetTimestampCard
          createdAt={asset.createdAt}
          updatedAt={asset.updatedAt}
          label="Video details"
          triggerClassName="-my-1 ml-auto"
        />
      </div>
      {description ? (
        <div className="w-full pt-2">
          {descriptionHeights ? (
            <motion.div
              initial={false}
              animate={{
                height: descriptionExpanded
                  ? descriptionHeights.expanded
                  : descriptionHeights.collapsed,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : VIDEO_VIEWER_DESCRIPTION_TRANSITION
              }
              onAnimationComplete={() => {
                if (!descriptionExpanded) {
                  setDescriptionClamped(true);
                }
              }}
              className="overflow-hidden"
            >
              {descriptionParagraph}
            </motion.div>
          ) : (
            descriptionParagraph
          )}
          {descriptionIsLong ? (
            <button
              type="button"
              className="mt-1 text-sm font-medium text-foreground/70 transition-colors duration-75 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none motion-reduce:transition-none"
              aria-expanded={descriptionExpanded}
              onClick={() => {
                const expanding = !descriptionExpanded;
                setDescriptionExpanded(expanding);
                // Stay unclamped while the box animates, unless motion is
                // reduced and the clamp can be reapplied immediately.
                setDescriptionClamped(!expanding && reduceMotion === true);
              }}
            >
              {descriptionExpanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      ) : descriptionUnavailable ? (
        <p
          className={cn(
            "pt-2 text-sm leading-relaxed text-muted-foreground",
            large && "text-base! leading-7!",
          )}
        >
          Description unavailable.
        </p>
      ) : null}
    </div>
  );
}

function VideoLinkNoteEditor({
  asset,
  className,
  open,
  workspaceSlug,
}: {
  asset: VideoLinkAsset;
  className?: string;
  open: boolean;
  workspaceSlug: string;
}) {
  const { mutateAsync: updateLinkAsync } = useUpdateLink(workspaceSlug);
  const queryClient = useQueryClient();
  const { syncPeekVideoNote } = useWorkspacePeek();
  const [note, setNote] = useState("");
  const editedLabel = formatVideoEditedLabel(asset.updatedAt, asset.createdAt);
  const assetIdRef = useRef<string | undefined>(undefined);
  const assetNoteRef = useRef(asset.note);
  const draftRef = useRef("");
  const savedRef = useRef(new Map<string, string>());
  const timerRef = useRef<number | undefined>(undefined);
  const requestRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(new Map<string, string>());

  assetNoteRef.current = asset.note;

  const persistNote = useCallback(
    (assetId: string, draft: string) => {
      const nextNote = draft.trim() ? draft : null;
      const saved = savedRef.current.get(assetId) ?? null;
      if (nextNote === saved) {
        clearLinkNoteDraft(workspaceSlug, assetId);
        return;
      }

      if (requestRef.current) {
        queuedRef.current.set(assetId, draft);
        return;
      }

      const request = updateLinkAsync({ assetId, note: nextNote })
        .then(({ link }) => {
          const savedNote = link.note ?? "";
          savedRef.current.set(assetId, savedNote);
          syncPeekVideoNote(assetId, link.note ?? null);
          void queryClient.invalidateQueries({
            queryKey: ["workspace-asset", workspaceSlug, assetId],
            exact: true,
          });

          if (assetIdRef.current === assetId) {
            if (draftRef.current === draft) {
              draftRef.current = savedNote;
              setNote(savedNote);
              clearLinkNoteDraft(workspaceSlug, assetId);
            } else {
              queuedRef.current.set(assetId, draftRef.current);
            }
          } else {
            clearLinkNoteDraft(workspaceSlug, assetId);
          }
        })
        .catch((error: unknown) => {
          saveLinkNoteDraft(workspaceSlug, assetId, draft);
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not save link note.",
          );
        })
        .finally(() => {
          requestRef.current = null;
          const queued = queuedRef.current.get(assetId);
          if (queued !== undefined) {
            queuedRef.current.delete(assetId);
            persistNote(assetId, queued);
            return;
          }

          const nextQueued = queuedRef.current.entries().next().value;
          if (nextQueued) {
            const [nextAssetId, nextDraft] = nextQueued;
            queuedRef.current.delete(nextAssetId);
            persistNote(nextAssetId, nextDraft);
          }
        });

      requestRef.current = request;
    },
    [queryClient, syncPeekVideoNote, updateLinkAsync, workspaceSlug],
  );

  const flushNote = useCallback(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    const assetId = assetIdRef.current;
    if (assetId) persistNote(assetId, draftRef.current);
  }, [persistNote]);

  useEffect(() => {
    flushNote();

    const assetId = asset.id;
    const serverNote = assetNoteRef.current ?? "";
    const recoveredDraft = readLinkNoteDraft(workspaceSlug, assetId);
    const nextDraft = recoveredDraft ?? serverNote;

    assetIdRef.current = assetId;
    savedRef.current.set(assetId, serverNote);
    draftRef.current = nextDraft;
    setNote(nextDraft);

    if (recoveredDraft !== undefined && recoveredDraft !== serverNote) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        persistNote(assetId, recoveredDraft);
      }, LINK_NOTE_AUTOSAVE_DELAY_MS);
    }
  }, [asset.id, flushNote, persistNote, workspaceSlug]);

  useEffect(() => {
    if (!open) flushNote();
  }, [flushNote, open]);

  useEffect(() => () => flushNote(), [flushNote]);

  const handleChange = useCallback(
    (value: string) => {
      const assetId = assetIdRef.current;
      if (!assetId) return;

      draftRef.current = value;
      setNote(value);
      saveLinkNoteDraft(workspaceSlug, assetId, value);

      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        persistNote(assetId, draftRef.current);
      }, LINK_NOTE_AUTOSAVE_DELAY_MS);
    },
    [persistNote, workspaceSlug],
  );

  return (
    <div className={cn("pt-3", className)}>
      <label
        htmlFor={`link-note-${asset.id}`}
        className="text-xs font-medium text-muted-foreground"
      >
        Notes
      </label>
      <AutoResizeTextarea
        id={`link-note-${asset.id}`}
        spellCheck={false}
        value={note}
        onChange={(event) => handleChange(event.target.value)}
        placeholder="Add a note"
        rows={1}
        className="mt-1 block min-h-6 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
      />
      {editedLabel ? (
        <p className="mt-1 text-xs text-muted-foreground/70">{editedLabel}</p>
      ) : null}
    </div>
  );
}

function isVideoLinkAsset(
  asset: LinkAsset | undefined,
): asset is VideoLinkAsset {
  return asset?.video?.provider === "youtube";
}

/**
 * Relative edit time for the note editor, matching the note editor's save
 * status copy. The card in the metadata block carries the absolute timestamps.
 */
export function formatVideoEditedLabel(
  updatedAt: string | undefined,
  createdAt: string | undefined,
  now = Date.now(),
): string | undefined {
  if (!updatedAt || !hasAssetBeenEdited(createdAt, updatedAt)) return undefined;
  const time = formatNoteHeaderEditTime(updatedAt, now);
  return time ? `Edited ${time}` : undefined;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
}
