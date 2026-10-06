import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ImageIcon,
  LocateFixedIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  Minimize2Icon,
  PanelRightIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import { ProgressiveImage } from "@/components/ui/progressive-image";

import {
  type ColorSearchScope,
  useWeightedColorImageSearch,
} from "@/api/color-search";
import { Button } from "@/components/ui/button";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { AssetTimestampCard } from "@/components/board/asset-timestamp-card";
import {
  AssetNotesButton,
  AssetNotesPanel,
} from "@/components/board/asset-notes-panel";
import { ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS } from "@/components/board/asset-viewer-control-styles";
import { useUpdateColor } from "@/api/collection";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { colorAssetToSearchColors } from "@/lib/color-asset-search";
import { resolveGradientCss } from "@/lib/color-gradient";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ColorAsset, ImageAsset } from "@/types/asset";
import { useWorkspacePeek } from "@/components/app-shell/workspace-peek";
import { useAssetFullscreenMorph } from "@/components/board/use-asset-fullscreen-morph";
import { cn } from "@/lib/utils";

const EMPTY_RESULTS: never[] = [];
const COLOR_VIEWER_LAYOUT_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function ColorDetailDrawer({
  assetModalId,
  sharedEntry = false,
  sharedMorphing = false,
  color,
  workspaceSlug,
  scope,
  onClose,
  onDismissAll,
  onCloseComplete,
  onOpenImage,
  onEdit,
  onShowInBoard,
  view,
  onViewChange,
  open = color !== undefined,
  loading = false,
}: {
  assetModalId?: string;
  sharedEntry?: boolean;
  sharedMorphing?: boolean;
  color?: ColorAsset;
  workspaceSlug: string;
  scope: ColorSearchScope;
  onClose: () => void;
  onDismissAll?: () => void;
  onCloseComplete?: () => void;
  onOpenImage: (image: ImageAsset) => void;
  onEdit?: () => void;
  onShowInBoard?: () => void;
  view?: "modal" | "full";
  onViewChange?: (view: "modal" | "full") => void;
  open?: boolean;
  loading?: boolean;
}) {
  const { peekColor, target: peekTarget } = useWorkspacePeek();
  const isMobile = useIsMobile();
  const split = Boolean(peekTarget) && !isMobile;
  const drawerStyle = {
    "--drawer-content-width": split
      ? "min(34rem, calc(100dvw - var(--workspace-peek-rail-width) - var(--app-shell-inset) - var(--app-shell-inset) - var(--app-shell-inset)))"
      : "34rem",
    "--drawer-inset": "var(--app-shell-inset)",
    "--bleed": "0",
  } as unknown as CSSProperties;
  const drawerClassName = cn(
    "max-h-[calc(100dvh-var(--app-shell-inset)-var(--app-shell-inset))] gap-0 rounded-xl! border-0! bg-background! p-0 text-foreground! shadow-none ring-1 ring-foreground/10",
    split &&
      "md:right-[calc(var(--workspace-peek-rail-width)+var(--workspace-peek-stage-gap)+var(--app-shell-inset))]",
  );
  const [activeColor, setActiveColor] = useState<ColorAsset | undefined>(color);
  useEffect(() => {
    if (color) setActiveColor(color);
  }, [color]);
  const displayedColor = color ?? (loading ? undefined : activeColor);
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = view ? view === "full" : localExpanded;
  const setExpanded = (value: boolean) => {
    if (onViewChange) onViewChange(value ? "full" : "modal");
    else setLocalExpanded(value);
  };
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchColors = useMemo(
    () => (displayedColor ? colorAssetToSearchColors(displayedColor) : []),
    [displayedColor],
  );
  const effectiveScope = useMemo<ColorSearchScope>(
    () =>
      scope.type === "collection" ? { ...scope, includeDescendants } : scope,
    [includeDescendants, scope],
  );
  const search = useWeightedColorImageSearch(
    workspaceSlug,
    effectiveScope,
    searchColors,
  );
  const results = search.data?.results ?? EMPTY_RESULTS;
  const hasGradient =
    displayedColor?.gradient !== undefined && displayedColor?.gradient !== null;
  const gradientCss = hasGradient
    ? resolveGradientCss(displayedColor!.gradient!)
    : undefined;

  useEffect(() => setIncludeDescendants(false), [displayedColor?.id]);

  function copyValue() {
    const value = gradientCss ?? displayedColor?.hex ?? "";
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        toast.success(hasGradient ? "Copied CSS gradient." : "Copied color.");
        setCopied(true);
        if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
        copiedTimeout.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => toast.error("Unable to copy color."));
  }

  if (!isMobile) {
    return (
      <ColorDetailModal
        assetModalId={assetModalId}
        sharedEntry={sharedEntry}
        sharedMorphing={sharedMorphing}
        color={displayedColor}
        loading={loading}
        open={open}
        expanded={expanded}
        notesOpen={notesOpen}
        onNotesOpenChange={setNotesOpen}
        onExpandedChange={setExpanded}
        onClose={onClose}
        onDismissAll={onDismissAll}
        onCloseComplete={onCloseComplete}
        onEdit={onEdit}
        onShowInBoard={onShowInBoard}
        onPeek={
          displayedColor
            ? () => {
                void peekColor(displayedColor, effectiveScope, {
                  demoteMain: true,
                }).then((opened) => {
                  if (opened) onClose();
                });
              }
            : undefined
        }
        copyValue={copyValue}
        copied={copied}
        gradientCss={gradientCss}
        hasGradient={hasGradient}
        scope={scope}
        includeDescendants={includeDescendants}
        onIncludeDescendantsChange={setIncludeDescendants}
        results={results}
        searching={search.isLoading || search.isSearching}
        error={search.isError}
        onRetry={() => void search.refetch()}
        onOpenImage={onOpenImage}
        workspaceSlug={workspaceSlug}
      />
    );
  }

  return (
    <Drawer
      open={open}
      modal={!split}
      onOpenChange={(next, details) => {
        if (!next) {
          if (details.reason === "outside-press" && onDismissAll)
            onDismissAll();
          else onClose();
        }
      }}
      onOpenChangeComplete={(next) => !next && onCloseComplete?.()}
      swipeDirection={isMobile ? "down" : "right"}
      fast
    >
      {displayedColor ? (
        <DrawerContent
          initialFocus={false}
          className={drawerClassName}
          style={drawerStyle}
        >
          <DrawerHeader className="flex-row! items-start justify-between gap-4 border-b px-4 py-4 text-left!">
            <div className="flex min-w-0 items-center gap-3.5">
              <button
                type="button"
                onClick={copyValue}
                aria-label={
                  hasGradient ? "Copy CSS gradient" : "Copy hex color"
                }
                className="group/swatch relative size-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                style={
                  gradientCss
                    ? { background: gradientCss }
                    : { backgroundColor: displayedColor.hex }
                }
              >
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/0 text-white opacity-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] transition-[background-color,opacity] duration-75 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/swatch:bg-black/25 group-hover/swatch:opacity-100 focus-visible:bg-black/25 focus-visible:opacity-100"
                >
                  <CopyFeedbackIcon copied={copied} className="size-4" />
                </span>
              </button>
              <div className="min-w-0">
                <DrawerTitle className="truncate text-base leading-tight font-medium">
                  {displayedColor.title?.trim() ||
                    displayedColor.hex.toUpperCase()}
                </DrawerTitle>
                <DrawerDescription className="font-mono text-xs">
                  {hasGradient
                    ? `${displayedColor.gradient?.type === "radial" ? "Radial" : "Linear"} gradient`
                    : displayedColor.hex.toUpperCase()}
                </DrawerDescription>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <AssetNotesButton
                hasNote={Boolean(displayedColor.note?.trim())}
                open={notesOpen}
                onClick={() => setNotesOpen((current) => !current)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close color"
                onClick={onDismissAll ?? onClose}
              >
                <XIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Peek"
                title="Peek color"
                onClick={() => {
                  if (!displayedColor) return;
                  void peekColor(displayedColor, effectiveScope, {
                    demoteMain: true,
                  }).then((opened) => {
                    if (opened) onClose();
                  });
                }}
              >
                <PanelRightIcon className="size-4" />
              </Button>
              {onShowInBoard ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Show in board"
                        onClick={onShowInBoard}
                      />
                    }
                  >
                    <LocateFixedIcon className="size-4" />
                    <span className="sr-only">Show in board</span>
                  </TooltipTrigger>
                  <TooltipContent>Show in board</TooltipContent>
                </Tooltip>
              ) : null}
              {onEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit color"
                  onClick={onEdit}
                >
                  <PencilIcon className="size-4" />
                </Button>
              ) : null}
              <AssetTimestampCard
                createdAt={displayedColor.createdAt}
                updatedAt={displayedColor.updatedAt}
                label="Color details"
              />
            </div>
          </DrawerHeader>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-4">
                <span className="text-sm font-medium text-primary">
                  Relevant images
                </span>
                {scope.type === "collection" ? (
                  <Tabs
                    value={includeDescendants ? "collection" : "view"}
                    onValueChange={(value) =>
                      setIncludeDescendants(value === "collection")
                    }
                    variant="segment"
                    size="sm"
                  >
                    <TabsList aria-label="Search scope">
                      <TabsTrigger value="view">This view</TabsTrigger>
                      <TabsTrigger value="collection">
                        Entire collection
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}
              </div>

              <div className="relative min-h-0 flex-1">
                <ScrollArea className="size-full [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-4 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-1 [&_[data-slot=scroll-area-thumb]]:w-2 [&_[data-slot=scroll-area-thumb]]:bg-sidebar-foreground/55 [&_[data-slot=scroll-area-thumb]]:backdrop-blur-sm">
                  <div className="min-h-full px-4 pt-0 pb-4">
                    {search.isLoading || search.isSearching ? (
                      <ColorResultsSkeleton />
                    ) : search.isError ? (
                      <ColorSearchError onRetry={() => void search.refetch()} />
                    ) : results.length === 0 ? (
                      <ColorSearchEmpty />
                    ) : (
                      <div className="columns-2 gap-3">
                        {results.map((result) => {
                          const location =
                            result.location.type === "collection" &&
                            result.location.folderNames.length > 0
                              ? result.location.folderNames.join(" / ")
                              : result.location.type === "collection"
                                ? "Collection root"
                                : "Inbox";
                          return (
                            <ImageResultTile
                              key={result.image.id}
                              image={result.image}
                              label={location}
                              onOpen={() => {
                                onOpenImage({
                                  id: result.image.id,
                                  type: "image",
                                  url: result.image.url,
                                  width: result.image.width,
                                  height: result.image.height,
                                  title: result.image.title ?? undefined,
                                  alt: result.image.alt ?? undefined,
                                  blurDataURL:
                                    result.image.blurDataURL ?? undefined,
                                  dominantColors: result.image.dominantColors,
                                });
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <AssetNotesPanel
              open={notesOpen}
              expanded={false}
              onClose={() => setNotesOpen(false)}
            >
              {displayedColor ? (
                <ColorNoteEditor
                  asset={displayedColor}
                  workspaceSlug={workspaceSlug}
                />
              ) : null}
            </AssetNotesPanel>
          </div>
        </DrawerContent>
      ) : loading ? (
        <DrawerContent
          initialFocus={false}
          className={drawerClassName}
          style={drawerStyle}
        >
          <DrawerTitle className="sr-only">Loading color</DrawerTitle>
          <DrawerDescription className="sr-only">
            Loading color details.
          </DrawerDescription>
          <ColorDetailLoading mobile scope={scope} />
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function ColorDetailModal({
  assetModalId,
  sharedEntry,
  sharedMorphing,
  color,
  loading,
  open,
  expanded,
  notesOpen,
  onNotesOpenChange,
  onExpandedChange,
  onClose,
  onDismissAll,
  onCloseComplete,
  onEdit,
  onShowInBoard,
  onPeek,
  copyValue,
  copied,
  gradientCss,
  hasGradient,
  scope,
  includeDescendants,
  onIncludeDescendantsChange,
  results,
  searching,
  error,
  onRetry,
  onOpenImage,
  workspaceSlug,
}: {
  assetModalId?: string;
  sharedEntry: boolean;
  sharedMorphing: boolean;
  color?: ColorAsset;
  loading: boolean;
  open: boolean;
  expanded: boolean;
  notesOpen: boolean;
  onNotesOpenChange: (open: boolean) => void;
  onExpandedChange: (value: boolean) => void;
  onClose: () => void;
  onDismissAll?: () => void;
  onCloseComplete?: () => void;
  onEdit?: () => void;
  onShowInBoard?: () => void;
  onPeek?: () => void;
  copyValue: () => void;
  copied: boolean;
  gradientCss?: string;
  hasGradient: boolean;
  scope: ColorSearchScope;
  includeDescendants: boolean;
  onIncludeDescendantsChange: (value: boolean) => void;
  results: Array<{
    image: {
      id: string;
      url: string;
      width: number;
      height: number;
      title: string | null;
      alt: string | null;
      blurDataURL: string | null;
      dominantColors: string[];
    };
    location: { type: "inbox" } | { type: "collection"; folderNames: string[] };
  }>;
  searching: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenImage: (image: ImageAsset) => void;
  workspaceSlug: string;
}) {
  const title =
    color?.title?.trim() || color?.hex.toUpperCase() || "Loading color";
  const hasAlpha = color?.hex.length === 9 && !color.hex.endsWith("ff");
  const reduceMotion = useReducedMotion();
  const presentation = expanded ? "fullscreen" : "modal";
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : COLOR_VIEWER_LAYOUT_TRANSITION;
  const fullscreenTransitionDuration = assetModalId
    ? expanded
      ? "duration-[400ms]"
      : "duration-[350ms]"
    : "duration-[180ms]";
  const {
    panelRef: fullscreenPanelRef,
    captureCurrentRect: captureFullscreenPanel,
  } = useAssetFullscreenMorph(
    Boolean(assetModalId) && open && !sharedMorphing,
    expanded,
  );
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
      onOpenChangeComplete={(next) => !next && onCloseComplete?.()}
    >
      <DialogContent
        ref={fullscreenPanelRef}
        initialFocus={false}
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
                  : { duration: open ? 0.25 : 0.15, ease: [0.22, 1, 0.36, 1] },
              scale:
                reduceMotion || (sharedEntry && open)
                  ? { duration: 0 }
                  : { duration: open ? 0.25 : 0.15, ease: [0.22, 1, 0.36, 1] },
            }}
            style={{ transformOrigin: "center center" }}
          />
        }
        className={cn(
          "flex min-h-0 max-h-[calc(100svh-2rem)] flex-col overflow-hidden transition-[background-color,box-shadow,border-radius] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          fullscreenTransitionDuration,
          expanded
            ? "top-0 left-0 h-dvh max-h-dvh w-dvw max-w-none translate-x-0 translate-y-0 rounded-none bg-background shadow-none ring-1 ring-transparent"
            : "top-1/2 h-[min(48rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[76rem] -translate-y-1/2 rounded-xl bg-popover/80 shadow-2xl ring-1 ring-foreground/10",
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Color details and relevant images.
        </DialogDescription>
        <motion.div
          layout={!sharedMorphing && !assetModalId}
          layoutDependency={presentation}
          transition={{ layout: layoutTransition }}
          className={cn(
            "flex shrink-0 items-center gap-0.5 p-2 transition-[background-color,border-radius] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            fullscreenTransitionDuration,
            expanded &&
              "mt-[var(--app-shell-inset)] bg-background pl-[calc(var(--app-shell-inset)+0.5rem)]",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 rounded-lg",
              ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
            )}
            aria-label="Close color"
            onClick={onDismissAll ?? onClose}
          >
            <XIcon className="size-4" />
          </Button>
          {onPeek ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-lg",
                ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
              )}
              aria-label="Peek color"
              onClick={onPeek}
            >
              <PanelRightIcon className="size-4" />
            </Button>
          ) : null}
          {onShowInBoard ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-lg",
                ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
              )}
              aria-label="Show in board"
              onClick={onShowInBoard}
            >
              <LocateFixedIcon className="size-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-8 rounded-lg",
              ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
            )}
            aria-label={expanded ? "Return to modal" : "Expand color"}
            onClick={() => {
              captureFullscreenPanel();
              onExpandedChange(!expanded);
            }}
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
                      : { duration: 0.08, ease: [0.22, 1, 0.36, 1] }
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
          </Button>
          <span className="max-w-[min(32rem,calc(100vw-14rem))] min-w-0 truncate px-1 text-sm font-medium text-foreground">
            {title}
          </span>
          <AssetNotesButton
            hasNote={Boolean(color?.note?.trim())}
            open={notesOpen}
            onClick={() => onNotesOpenChange(!notesOpen)}
            className="ml-auto"
          />
          {onEdit ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-lg",
                ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
              )}
              aria-label="Edit color"
              onClick={onEdit}
            >
              <PencilIcon className="size-4" />
            </Button>
          ) : null}
          {color ? (
            <AssetTimestampCard
              createdAt={color.createdAt}
              updatedAt={color.updatedAt}
              label="Color details"
              triggerClassName={ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS}
            />
          ) : null}
        </motion.div>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <DialogBody
            className={cn(
              "h-full min-h-0 min-w-0 flex-1 overflow-hidden border-t border-b-0 bg-background p-0 transition-[border-color,border-radius] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              fullscreenTransitionDuration,
              expanded
                ? "rounded-none border-transparent"
                : "rounded-t-xl border-border",
            )}
          >
            {color ? (
              <div className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
                  <button
                    data-asset-modal-hero
                    type="button"
                    onClick={copyValue}
                    aria-label={
                      hasGradient ? "Copy CSS gradient" : "Copy hex color"
                    }
                    className={cn(
                      "group relative h-[clamp(5rem,20dvh,10rem)] w-full overflow-hidden rounded-xl text-left",
                      hasAlpha &&
                        "bg-size-[16px_16px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#ffffff_0_50%)]",
                    )}
                    style={
                      gradientCss
                        ? { background: gradientCss }
                        : { backgroundColor: color.hex }
                    }
                  >
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                      <CopyFeedbackIcon
                        copied={copied}
                        className="mr-2 size-4"
                      />
                      Copy
                    </span>
                  </button>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {hasGradient
                      ? `${color.gradient?.type === "radial" ? "Radial" : "Linear"} gradient`
                      : color.hex.toUpperCase()}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-medium">Relevant images</span>
                    {scope.type === "collection" ? (
                      <Tabs
                        key={presentation}
                        value={includeDescendants ? "collection" : "view"}
                        onValueChange={(value) =>
                          onIncludeDescendantsChange(value === "collection")
                        }
                        variant="segment"
                        size="sm"
                      >
                        <TabsList aria-label="Search scope">
                          <TabsTrigger value="view">This view</TabsTrigger>
                          <TabsTrigger value="collection">
                            Entire collection
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    ) : null}
                  </div>
                </div>
                <ScrollArea className="min-h-0 min-w-0 flex-1">
                  <div className="px-4 pt-4 pb-5 sm:px-5">
                    {searching ? (
                      <ColorResultsSkeleton />
                    ) : error ? (
                      <ColorSearchError onRetry={onRetry} />
                    ) : results.length === 0 ? (
                      <ColorSearchEmpty />
                    ) : (
                      <div className="columns-2 gap-3 lg:columns-3">
                        {results.map((result) => (
                          <ImageResultTile
                            key={result.image.id}
                            image={result.image}
                            label={
                              result.location.type === "collection" &&
                              result.location.folderNames.length
                                ? result.location.folderNames.join(" / ")
                                : result.location.type === "collection"
                                  ? "Collection root"
                                  : "Inbox"
                            }
                            onOpen={() =>
                              onOpenImage({
                                ...result.image,
                                type: "image",
                                title: result.image.title ?? undefined,
                                alt: result.image.alt ?? undefined,
                                blurDataURL:
                                  result.image.blurDataURL ?? undefined,
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : loading ? (
              <ColorDetailLoading scope={scope} />
            ) : null}
          </DialogBody>
          <AssetNotesPanel
            open={notesOpen}
            expanded={expanded}
            onClose={() => onNotesOpenChange(false)}
          >
            {color ? (
              <ColorNoteEditor asset={color} workspaceSlug={workspaceSlug} />
            ) : null}
          </AssetNotesPanel>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorNoteEditor({
  asset,
  workspaceSlug,
  className,
}: {
  asset: ColorAsset;
  workspaceSlug: string;
  className?: string;
}) {
  const { mutate } = useUpdateColor(workspaceSlug);
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  const [note, setNote] = useState(asset.note ?? "");
  const timer = useRef<number | undefined>(undefined);
  const assetIdRef = useRef(asset.id);
  const draftRef = useRef(note);
  const previousServerNoteRef = useRef(asset.note ?? "");
  useEffect(() => {
    const serverNote = asset.note ?? "";
    if (assetIdRef.current !== asset.id) {
      assetIdRef.current = asset.id;
      draftRef.current = serverNote;
      setNote(serverNote);
    } else if (draftRef.current === previousServerNoteRef.current) {
      draftRef.current = serverNote;
      setNote(serverNote);
    }
    previousServerNoteRef.current = serverNote;
  }, [asset.id, asset.note]);
  useEffect(
    () => () => {
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
        const value = draftRef.current;
        mutateRef.current({
          assetId: assetIdRef.current,
          note: value.trim() ? value : null,
        });
      }
    },
    [],
  );
  const save = (value: string) =>
    mutate({ assetId: asset.id, note: value.trim() ? value : null });
  return (
    <div className={className}>
      <label htmlFor={`color-note-${asset.id}`} className="sr-only">
        Notes
      </label>
      <AutoResizeTextarea
        id={`color-note-${asset.id}`}
        spellCheck={false}
        value={note}
        onBlur={() => {
          if (timer.current !== undefined) window.clearTimeout(timer.current);
          timer.current = undefined;
          save(note);
        }}
        onChange={(event) => {
          const value = event.target.value;
          draftRef.current = value;
          setNote(value);
          if (timer.current !== undefined) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            timer.current = undefined;
            save(value);
          }, 350);
        }}
        placeholder="Add a note"
        rows={1}
        className="mt-1 block max-h-28 min-h-6 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

function ImageResultTile({
  image,
  label,
  onOpen,
}: {
  image: {
    id: string;
    url: string;
    width: number;
    height: number;
    title: string | null;
    alt: string | null;
    blurDataURL: string | null;
    dominantColors: string[];
  };
  label: string;
  onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      className="group/tile relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-lg border border-transparent text-left focus-visible:ring-2 focus-visible:ring-ring"
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onOpen}
    >
      <div className="absolute inset-0 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/tile:scale-[1.025] motion-reduce:transition-none">
        <ProgressiveImage
          src={image.url}
          blurDataURL={image.blurDataURL ?? undefined}
          alt={image.alt ?? image.title ?? "Color match"}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <AnimatePresence>
        {hovered ? (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5"
          >
            <span className="inline-flex max-w-full min-w-0 items-center rounded-lg bg-sidebar/70 px-3 py-1.5 text-xs font-medium text-sidebar-foreground">
              <span className="truncate">{label}</span>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </button>
  );
}

function ColorResultsSkeleton() {
  return (
    <div
      className="columns-2 gap-3 lg:columns-3"
      aria-label="Searching for images"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className={cn(
            "mb-3 animate-pulse break-inside-avoid rounded-lg bg-muted",
            index % 3 === 0 ? "h-28 sm:h-36" : "h-24 sm:h-32",
          )}
        />
      ))}
    </div>
  );
}

function ColorDetailLoading({
  scope,
  mobile = false,
}: {
  scope: ColorSearchScope;
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        role="status"
        aria-label="Loading color details"
      >
        <div className="flex items-center gap-3.5 border-b p-4">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
        <div className="border-b px-4 py-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <Skeleton className="h-4 w-28" />
          {scope.type === "collection" ? (
            <Skeleton className="h-8 w-52 rounded-lg" />
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
          <ColorResultsSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col"
      role="status"
      aria-label="Loading color details"
    >
      <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
        <Skeleton
          data-asset-modal-hero
          className="h-[clamp(5rem,20dvh,10rem)] w-full rounded-xl"
        />
        <Skeleton className="mt-4 h-6 w-48" />
        <Skeleton className="mt-2 h-3 w-24" />
        <div className="mt-5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <div className="mt-8 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          {scope.type === "collection" ? (
            <Skeleton className="h-8 w-52 rounded-lg" />
          ) : null}
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden px-4 pt-4 pb-5 sm:px-5">
        <ColorResultsSkeleton />
      </div>
    </div>
  );
}

function ColorSearchEmpty() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center text-center">
      <ImageIcon className="size-5 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">No matching images</p>
      <p className="mt-1 max-w-52 text-xs text-muted-foreground">
        Try a broader collection search or add images with similar colors.
      </p>
    </div>
  );
}

function ColorSearchError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center text-center">
      <LoaderCircleIcon className="size-5 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">Couldn’t search images</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  );
}
