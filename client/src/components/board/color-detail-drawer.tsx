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
  ArrowLeftIcon,
  InfoIcon,
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
import { useUpdateColor } from "@/api/collection";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Drawer,
  DrawerClose,
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
import { gradientToCss } from "@/lib/color-gradient";
import { formatNoteMetadataDateTime } from "@/lib/note-date-format";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ColorAsset, ImageAsset } from "@/types/asset";
import { useWorkspacePeek } from "@/components/app-shell/workspace-peek";
import { cn } from "@/lib/utils";

const EMPTY_RESULTS: never[] = [];
const COLOR_VIEWER_LAYOUT_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function ColorDetailDrawer({
  color,
  workspaceSlug,
  scope,
  onClose,
  onCloseComplete,
  onOpenImage,
  onEdit,
  onShowInBoard,
  open = color !== undefined,
  loading = false,
}: {
  color?: ColorAsset;
  workspaceSlug: string;
  scope: ColorSearchScope;
  onClose: () => void;
  onCloseComplete?: () => void;
  onOpenImage: (image: ImageAsset) => void;
  onEdit?: () => void;
  onShowInBoard?: () => void;
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
  const [expanded, setExpanded] = useState(false);
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
    ? gradientToCss(
        displayedColor!.gradient?.stops ?? [
          { color: displayedColor!.gradient!.from, position: 0 },
          { color: displayedColor!.gradient!.to, position: 100 },
        ],
        displayedColor!.gradient?.type ?? "linear",
        displayedColor!.gradient?.angle ?? 90,
      )
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
        color={displayedColor}
        loading={loading}
        open={open}
        expanded={expanded}
        onExpandedChange={setExpanded}
        onClose={onClose}
        onCloseComplete={onCloseComplete}
        onEdit={onEdit}
        onShowInBoard={onShowInBoard}
        onPeek={
          displayedColor
            ? () => {
                peekColor(displayedColor, effectiveScope);
                onClose();
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
      onOpenChange={(next) => !next && onClose()}
      onOpenChangeComplete={(next) => !next && onCloseComplete?.()}
      swipeDirection={isMobile ? "down" : "right"}
      fast
    >
      {displayedColor ? (
        <DrawerContent className={drawerClassName} style={drawerStyle}>
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
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Peek"
                title="Peek color"
                onClick={() => {
                  if (!displayedColor) return;
                  peekColor(displayedColor, effectiveScope);
                  onClose();
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
              <ColorInfoHoverCard color={displayedColor} />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DrawerClose
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Close"
                        />
                      }
                    />
                  }
                >
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </TooltipTrigger>
                <TooltipContent>
                  <span>Close</span>
                  <KbdGroup className="gap-0.5">
                    <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
                  </KbdGroup>
                </TooltipContent>
              </Tooltip>
            </div>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {displayedColor ? (
              <ColorNoteEditor
                asset={displayedColor}
                workspaceSlug={workspaceSlug}
                className="border-b px-4 pb-4"
              />
            ) : null}
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
        </DrawerContent>
      ) : loading ? (
        <DrawerContent className={drawerClassName} style={drawerStyle}>
          <DrawerTitle className="sr-only">Loading color</DrawerTitle>
          <DrawerDescription className="sr-only">
            Loading color details.
          </DrawerDescription>
          <div className="space-y-4 border-b p-4">
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="aspect-square rounded-lg" />
            ))}
          </div>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function ColorDetailModal({
  color,
  loading,
  open,
  expanded,
  onExpandedChange,
  onClose,
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
  color?: ColorAsset;
  loading: boolean;
  open: boolean;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
  onClose: () => void;
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
  const reduceMotion = useReducedMotion();
  const presentation = expanded ? "fullscreen" : "modal";
  const layoutTransition = reduceMotion
    ? { duration: 0 }
    : COLOR_VIEWER_LAYOUT_TRANSITION;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      onOpenChangeComplete={(next) => !next && onCloseComplete?.()}
    >
      <DialogContent
        showCloseButton={false}
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
          layout
          layoutDependency={presentation}
          transition={{ layout: layoutTransition }}
          className={cn(
            "flex shrink-0 items-center gap-0.5 p-2 transition-[background-color,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            expanded &&
              "mt-[var(--app-shell-inset)] bg-background pl-[calc(var(--app-shell-inset)+0.5rem)]",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label="Back to board"
            onClick={onClose}
          >
            <ArrowLeftIcon className="size-4" />
          </Button>
          {onPeek ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
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
              className="size-8 rounded-lg"
              aria-label="Show in board"
              onClick={onShowInBoard}
            >
              <LocateFixedIcon className="size-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label={expanded ? "Return to modal" : "Expand color"}
            onClick={() => onExpandedChange(!expanded)}
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
          {onEdit ? (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-8 rounded-lg"
              aria-label="Edit color"
              onClick={onEdit}
            >
              <PencilIcon className="size-4" />
            </Button>
          ) : null}
          {color ? (
            <ColorInfoHoverCard
              color={color}
              className={onEdit ? undefined : "ml-auto"}
            />
          ) : null}
        </motion.div>
        <DialogBody
          className={cn(
            "min-h-0 flex-1 overflow-hidden border-t border-b-0 bg-background p-0 transition-[border-color,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            expanded
              ? "rounded-none border-transparent"
              : "rounded-t-xl border-border",
          )}
        >
          {color ? (
            <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] [@media(min-width:900px)]:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
              <div className="flex min-h-0 min-w-0 flex-col">
                <div className="shrink-0 px-4 pt-4 sm:px-5 sm:pt-5">
                  <button
                    type="button"
                    onClick={copyValue}
                    aria-label={
                      hasGradient ? "Copy CSS gradient" : "Copy hex color"
                    }
                    className="group relative h-[clamp(5rem,20dvh,10rem)] w-full overflow-hidden rounded-xl text-left"
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
                  <h2 className="mt-4 text-xl font-medium">{title}</h2>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {hasGradient
                      ? `${color.gradient?.type === "radial" ? "Radial" : "Linear"} gradient`
                      : color.hex.toUpperCase()}
                  </p>
                  <ColorNoteEditor
                    asset={color}
                    workspaceSlug={workspaceSlug}
                    className="[@media(min-width:900px)]:hidden"
                  />
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
              <aside className="hidden min-h-0 min-w-0 overflow-y-auto bg-background [@media(min-width:900px)]:block">
                <ColorNoteEditor
                  asset={color}
                  workspaceSlug={workspaceSlug}
                  className="p-5"
                />
              </aside>
            </div>
          ) : loading ? (
            <ColorResultsSkeleton />
          ) : null}
        </DialogBody>
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
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );
  const save = (value: string) =>
    mutate({ assetId: asset.id, note: value.trim() ? value : null });
  return (
    <div className={cn("mt-5", className)}>
      <label
        htmlFor={`color-note-${asset.id}`}
        className="text-xs font-medium text-muted-foreground"
      >
        Notes
      </label>
      <AutoResizeTextarea
        id={`color-note-${asset.id}`}
        spellCheck={false}
        value={note}
        onBlur={() => save(note)}
        onChange={(event) => {
          const value = event.target.value;
          draftRef.current = value;
          setNote(value);
          if (timer.current !== undefined) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => save(value), 350);
        }}
        placeholder="Add a note"
        rows={1}
        className="mt-1 block max-h-28 min-h-6 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-6 outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}

function ColorInfoHoverCard({
  color,
  className,
}: {
  color: ColorAsset;
  className?: string;
}) {
  const createdLabel = color.createdAt
    ? formatNoteMetadataDateTime(color.createdAt)
    : undefined;
  const updatedTimestamp = color.updatedAt ?? color.createdAt;
  const updatedLabel = updatedTimestamp
    ? formatNoteMetadataDateTime(updatedTimestamp)
    : undefined;
  if (!createdLabel && !updatedLabel) return null;

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-8 rounded-lg", className)}
            aria-label="Color details"
          >
            <InfoIcon className="size-4" />
          </Button>
        }
      />
      <HoverCardContent
        align="end"
        sideOffset={10}
        className="w-fit min-w-0 border-border/60 bg-background/95 whitespace-nowrap shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col gap-1 text-xs">
          {createdLabel ? (
            <div>
              <span className="text-muted-foreground">Created at </span>
              <span>{createdLabel}</span>
            </div>
          ) : null}
          {updatedLabel ? (
            <div>
              <span className="text-muted-foreground">Edited </span>
              <span>{updatedLabel}</span>
            </div>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
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
