import {
  type CSSProperties,
  type ComponentType,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDraggable } from "@dnd-kit/react";
import {
  CheckIcon,
  ImagesIcon,
  ImportIcon,
  RefreshCwIcon,
  SearchIcon,
  SearchXIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { usePexelsSearch, type PexelsPhoto } from "@/api/pexels";
import { useCreateRemoteImage } from "@/api/collection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PEXELS_PHOTO_DRAG_TYPE,
  type PexelsPhotoDragData,
} from "@/lib/pexels-dnd";
import { toPexelsRemoteImageInput } from "@/lib/pexels-import";
import { cn } from "@/lib/utils";
import { useSessionStore, getPexelsBrowserScope } from "@/store";

const PEXELS_BROWSER_WIDTH_KEY = "pexels-browser-width";
const PEXELS_BROWSER_MIN_WIDTH = 420;
const PEXELS_BROWSER_MAX_WIDTH = 760;
const DEFAULT_PEXELS_BROWSER_WIDTH = 520;

const DOCK_THUMBNAIL_SIZE = 44;
const DOCK_THUMBNAIL_GAP = 6;
const DOCK_MIN_COUNT = 6;
const DOCK_MIN_WIDTH =
  DOCK_MIN_COUNT * DOCK_THUMBNAIL_SIZE +
  (DOCK_MIN_COUNT - 1) * DOCK_THUMBNAIL_GAP +
  16;

function getStoredBrowserWidth(): number {
  try {
    const saved = localStorage.getItem(PEXELS_BROWSER_WIDTH_KEY);
    if (saved) {
      const parsed = Number(saved);
      if (!Number.isNaN(parsed)) {
        return Math.min(
          Math.max(parsed, PEXELS_BROWSER_MIN_WIDTH),
          PEXELS_BROWSER_MAX_WIDTH,
        );
      }
    }
  } catch {}

  return DEFAULT_PEXELS_BROWSER_WIDTH;
}

const PexelsPhotoTile = memo(function PexelsPhotoTile({
  photo,
  isSelected,
  selectedPhotos,
  onToggle,
}: {
  photo: PexelsPhoto;
  isSelected: boolean;
  selectedPhotos: readonly PexelsPhoto[];
  onToggle: (photo: PexelsPhoto) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const photosToDrag = useMemo(
    () =>
      isSelected
        ? [photo, ...selectedPhotos.filter((item) => item.id !== photo.id)]
        : [photo],
    [isSelected, photo, selectedPhotos],
  );
  const dragData = useMemo<PexelsPhotoDragData>(
    () => ({ photos: photosToDrag }),
    [photosToDrag],
  );
  const { ref: draggableRef, isDragging } = useDraggable<PexelsPhotoDragData>({
    id: `pexels-photo:${photo.id}`,
    type: PEXELS_PHOTO_DRAG_TYPE,
    data: dragData,
  });
  const credit = photo.alt ?? photo.photographer.name;

  return (
    <button
      ref={draggableRef}
      type="button"
      aria-pressed={isSelected}
      aria-grabbed={isDragging}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        onToggle(photo);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group/tile relative mb-2 block w-full cursor-grab break-inside-avoid overflow-hidden rounded-lg border bg-muted text-left active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring",
        isSelected ? "border-primary" : "border-transparent",
        isDragging && "cursor-grabbing",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 animate-pulse bg-muted transition-opacity duration-300",
          loaded ? "opacity-0" : "opacity-100",
        )}
      />
      <img
        src={photo.urls.small}
        alt={photo.alt ?? "Pexels photo"}
        draggable={false}
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        className={cn(
          "relative block w-full object-cover transition-all duration-300 ease-out group-hover/tile:scale-[1.025]",
          loaded ? "opacity-100" : "opacity-0",
        )}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
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
              <span className="truncate">{credit}</span>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {isSelected ? (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary ring-inset" />
          <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <CheckIcon className="size-3.5" />
          </span>
        </>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-20 rounded-lg bg-sidebar/55 opacity-0 backdrop-blur-[1px] transition-opacity duration-100",
          isDragging && "opacity-100",
        )}
      />
    </button>
  );
});

function PexelsBrowserEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border bg-muted/50">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SelectedPhotosDock({
  selected,
  onRemove,
}: {
  selected: PexelsPhoto[];
  onRemove: (photo: PexelsPhoto) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hoverEdge, setHoverEdge] = useState<"left" | "right" | null>(null);

  const prevCountRef = useRef(selected.length);
  const scrollAnimRef = useRef<number | null>(null);

  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = selected.length;
    const viewport = viewportRef.current;
    if (!viewport || selected.length <= prevCount) return;
    const timeout = window.setTimeout(() => {
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current);
      }
      const target = viewport.scrollWidth - viewport.clientWidth;
      if (target <= 0) return;
      const start = viewport.scrollLeft;
      const delta = target - start;
      if (Math.abs(delta) < 1) return;
      const duration = 50;
      const startTime = performance.now();
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const step = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        viewport.scrollLeft = start + delta * easeOut(progress);
        if (progress < 1) {
          scrollAnimRef.current = requestAnimationFrame(step);
        } else {
          scrollAnimRef.current = null;
          requestAnimationFrame(() => {
            viewport.scrollLeft = viewport.scrollWidth;
          });
        }
      };
      scrollAnimRef.current = requestAnimationFrame(step);
    }, 220);
    return () => {
      window.clearTimeout(timeout);
      if (scrollAnimRef.current !== null) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
    };
  }, [selected.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !hoverEdge) return;
    const direction = hoverEdge === "right" ? 1 : -1;
    const interval = window.setInterval(() => {
      viewport.scrollBy({ left: direction * 10, behavior: "auto" });
    }, 16);
    return () => window.clearInterval(interval);
  }, [hoverEdge]);

  function handleMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const edgeThreshold = 48;
    const next =
      x <= edgeThreshold
        ? "left"
        : x >= rect.width - edgeThreshold
          ? "right"
          : null;
    setHoverEdge((current) => (current === next ? current : next));
  }

  return (
    <div
      ref={trackRef}
      className="relative w-max max-w-full"
      onMouseEnter={() => setHoverEdge(null)}
      onMouseLeave={() => setHoverEdge(null)}
      onMouseMove={handleMouseMove}
    >
      <div
        ref={viewportRef}
        className="flex max-w-full [scrollbar-width:none] overflow-x-auto py-0.5 [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex">
          <AnimatePresence initial={false}>
            {selected.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ width: 0, opacity: 0, marginRight: 0 }}
                animate={{
                  width: "auto",
                  opacity: 1,
                  marginRight: index === selected.length - 1 ? 0 : 6,
                }}
                exit={{
                  width: 0,
                  opacity: 0,
                  marginRight: 0,
                  transition: {
                    width: { duration: 0.1, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.08 },
                    marginRight: { duration: 0.08 },
                  },
                }}
                transition={{
                  width: { duration: 0.1, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.1 },
                  marginRight: { duration: 0.1, ease: [0.16, 1, 0.3, 1] },
                }}
                className="group/tb relative shrink-0 overflow-hidden"
              >
                <img
                  src={photo.urls.small}
                  alt={photo.alt ?? "Selected photo"}
                  className="size-11 rounded-md border border-white/10 object-cover"
                  loading="lazy"
                />
                <Button
                  aria-label={`Remove ${photo.alt ?? "selected photo"}`}
                  className="absolute inset-0 m-auto size-8 bg-black/55 text-white opacity-0 shadow-sm ring-1 ring-white/20 backdrop-blur-md transition-opacity duration-150 ease-out group-hover/tb:opacity-100 hover:bg-black/70 focus-visible:opacity-100"
                  size="icon"
                  type="button"
                  variant="ghost"
                  onClick={() => onRemove(photo)}
                >
                  <span className="scale-75 transition-transform duration-150 ease-out group-hover/tb:scale-100 group-focus-visible/tb:scale-100">
                    <XIcon />
                  </span>
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function PexelsBrowserPanel({
  open,
  workspaceSlug,
  collectionSlug,
  parentFolderPath,
}: {
  open: boolean;
  workspaceSlug: string;
  collectionSlug: string;
  parentFolderPath?: string;
}) {
  const scope = getPexelsBrowserScope(workspaceSlug, collectionSlug);
  const persistedState = useSessionStore(
    (state) => state.pexelsBrowserByScope[scope],
  );
  const savedQuery = persistedState?.query ?? "";
  const savedSelected = persistedState?.selected ?? [];
  const setSavedQuery = useSessionStore((state) => state.setPexelsBrowserQuery);
  const setSavedSelected = useSessionStore(
    (state) => state.setPexelsBrowserSelected,
  );
  const [input, setInput] = useState(savedQuery);
  const [query, setQuery] = useState(savedQuery);
  const [selected, setSelected] = useState<PexelsPhoto[]>(savedSelected);
  const [width, setWidth] = useState(getStoredBrowserWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [dockLayoutRevision, setDockLayoutRevision] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(width);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const search = usePexelsSearch(workspaceSlug, query);
  const createImage = useCreateRemoteImage(workspaceSlug, collectionSlug);

  widthRef.current = width;

  useEffect(() => {
    setInput(savedQuery);
    setQuery(savedQuery);
    setSelected(savedSelected);
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSavedQuery(scope, query);
  }, [scope, query, setSavedQuery]);

  useEffect(() => {
    setSavedSelected(scope, selected);
  }, [scope, selected, setSavedSelected]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(input.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const sentinel = sentinelRef.current;
    if (!viewport || !sentinel || !query) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((entry) => entry.isIntersecting) &&
          search.hasNextPage &&
          !search.isFetchingNextPage
        ) {
          void search.fetchNextPage();
        }
      },
      { root: viewport, rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    query,
    search.hasNextPage,
    search.isFetchingNextPage,
    search.fetchNextPage,
  ]);

  useEffect(() => {
    if (!open) return;
    searchInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let animationFrame: number | undefined;
    const observer = new ResizeObserver(() => {
      if (animationFrame !== undefined) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = undefined;
        setDockLayoutRevision((revision) => revision + 1);
      });
    });
    observer.observe(panel);
    return () => {
      observer.disconnect();
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    };
  }, []);

  function handleResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsResizing(true);
    const startX = event.clientX;
    const startWidth = widthRef.current;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        Math.max(
          startWidth + startX - moveEvent.clientX,
          PEXELS_BROWSER_MIN_WIDTH,
        ),
        Math.min(PEXELS_BROWSER_MAX_WIDTH, window.innerWidth * 0.7),
      );
      widthRef.current = nextWidth;
      panelRef.current?.style.setProperty(
        "--pexels-browser-width",
        `${nextWidth}px`,
      );
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      setWidth(widthRef.current);
      try {
        localStorage.setItem(
          PEXELS_BROWSER_WIDTH_KEY,
          String(widthRef.current),
        );
      } catch {}
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  const togglePhoto = useCallback((photo: PexelsPhoto) => {
    setSelected((current) =>
      current.some((item) => item.id === photo.id)
        ? current.filter((item) => item.id !== photo.id)
        : [...current, photo],
    );
  }, []);

  async function addSelected() {
    if (selected.length === 0) return;
    try {
      for (const photo of selected) {
        await createImage.mutateAsync({
          ...toPexelsRemoteImageInput(photo),
          parentFolderPath,
        });
      }
      toast.success(
        `${selected.length} photo${selected.length === 1 ? "" : "s"} added to board`,
      );
      setSelected([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add photo",
      );
    }
  }

  const photos = search.data?.pages.flatMap((page) => page.results);
  const selectedPhotoIds = useMemo(
    () => new Set(selected.map((photo) => photo.id)),
    [selected],
  );

  return (
    <aside
      ref={panelRef}
      aria-hidden={!open}
      className="group/panel text-sidebar-foreground"
      data-state={open ? "expanded" : "collapsed"}
      inert={!open || undefined}
      style={{ "--pexels-browser-width": `${width}px` } as CSSProperties}
    >
      <div
        className={cn(
          "relative hidden w-(--pexels-browser-width) transition-[width] ease-linear group-data-[state=collapsed]/panel:w-0 md:block",
          isResizing ? "duration-0" : "duration-120",
        )}
      />
      <div className="fixed inset-y-0 right-0 z-10 flex h-svh w-[min(var(--pexels-browser-width),100vw)] flex-col pr-2 transition-[right] duration-120 ease-linear group-data-[state=collapsed]/panel:-right-[min(var(--pexels-browser-width),100vw)] md:w-(--pexels-browser-width) md:group-data-[state=collapsed]/panel:-right-(--pexels-browser-width)">
        <div className="relative flex size-full flex-col overflow-hidden bg-sidebar">
          <div
            aria-label="Resize Pexels browser"
            aria-orientation="vertical"
            className="absolute top-1/2 left-0 z-20 hidden h-16 w-2 -translate-x-1/2 -translate-y-1/2 cursor-col-resize rounded-full bg-sidebar-foreground/50 transition-[background-color,height] duration-200 ease-out before:absolute before:-inset-x-2 before:-inset-y-4 before:content-[''] hover:h-20 hover:bg-sidebar-foreground/60 active:h-20 active:bg-primary md:block"
            role="separator"
            onPointerDown={handleResizeStart}
          />
          <div className="flex h-14 shrink-0 items-center gap-2 pr-0 pl-2 transition-[height] duration-120 ease-linear group-has-[[data-slot=sidebar][data-state=collapsed]]/sidebar-wrapper:h-12">
            <div className="relative min-w-0 flex-1">
              {search.isFetching && !search.isFetchingNextPage ? (
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground">
                  <span className="block size-3.5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground/80" />
                </span>
              ) : (
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                aria-label="Search Pexels photos"
                ref={searchInputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search photos"
                className="pt-0 pr-8 pb-0.5 pl-8 text-sm"
              />
              {input.length > 0 ? (
                <Button
                  aria-label="Clear search"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setInput("");
                    searchInputRef.current?.focus();
                  }}
                >
                  <XIcon className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="relative min-h-0 flex-1 pl-3">
            <ScrollArea
              className="size-full rounded-t-xl [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-4 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-1 [&_[data-slot=scroll-area-thumb]]:w-2 [&_[data-slot=scroll-area-thumb]]:bg-sidebar-foreground/55 [&_[data-slot=scroll-area-thumb]]:backdrop-blur-sm"
              viewportRef={viewportRef}
            >
              <div className="pexels-results-container flex min-h-full flex-col pr-0 pb-24">
                {query.length === 0 ? (
                  <PexelsBrowserEmptyState
                    icon={ImagesIcon}
                    title="Find photos to add"
                    description="Search the Pexels library to start collecting photos for your board."
                  />
                ) : search.isLoading ? (
                  <div className="pexels-results-grid columns-2 gap-2">
                    {Array.from({ length: 6 }, (_, index) => (
                      <div
                        key={index}
                        className="mb-2 aspect-[4/5] animate-pulse rounded-lg bg-muted"
                      />
                    ))}
                  </div>
                ) : photos && photos.length > 0 ? (
                  <>
                    <div
                      className={cn(
                        "pexels-results-grid columns-2 gap-2",
                        search.isPlaceholderData &&
                          "pointer-events-none opacity-50 transition-opacity",
                      )}
                    >
                      {photos.map((photo) => (
                        <PexelsPhotoTile
                          key={photo.id}
                          photo={photo}
                          isSelected={selectedPhotoIds.has(photo.id)}
                          selectedPhotos={selected}
                          onToggle={togglePhoto}
                        />
                      ))}
                    </div>
                    {search.isError ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <p className="text-xs text-muted-foreground">
                          Couldn't load the rest of the results.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void search.refetch()}
                        >
                          <RefreshCwIcon className="size-3.5" />
                          Retry
                        </Button>
                      </div>
                    ) : search.hasNextPage ? (
                      <div
                        ref={sentinelRef}
                        className="flex justify-center py-4"
                      >
                        {search.isFetchingNextPage ? (
                          <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
                        ) : null}
                      </div>
                    ) : (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        End of results
                      </p>
                    )}
                  </>
                ) : search.isError ? (
                  <PexelsBrowserEmptyState
                    icon={WifiOffIcon}
                    title="Search unavailable"
                    description={
                      search.error instanceof Error
                        ? search.error.message
                        : "Pexels search is unavailable."
                    }
                    action={
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void search.refetch()}
                      >
                        <RefreshCwIcon className="size-3.5" />
                        Retry
                      </Button>
                    }
                  />
                ) : (
                  <PexelsBrowserEmptyState
                    icon={SearchXIcon}
                    title="No results"
                    description={`No photos found for “${query}”. Try a different keyword.`}
                  />
                )}
              </div>
            </ScrollArea>
            <div className="pointer-events-none absolute right-0 bottom-0 left-3 z-10 flex justify-center pb-2">
              <AnimatePresence>
                {selected.length > 0 ? (
                  <motion.div
                    key="pexels-dock-cluster"
                    layout="size"
                    layoutDependency={dockLayoutRevision}
                    initial={{ opacity: 0, scale: 0.98, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      scale: 0.98,
                      y: 4,
                      transition: {
                        opacity: { duration: 0.1, ease: [0.8, 0, 1, 1] },
                        scale: { duration: 0.1, ease: [0.8, 0, 1, 1] },
                        y: { duration: 0.1, ease: [0.8, 0, 1, 1] },
                      },
                    }}
                    transition={{
                      opacity: { duration: 0.1, ease: [0, 0, 0.2, 1] },
                      scale: { duration: 0.1, ease: [0, 0, 0.2, 1] },
                      y: { duration: 0.1, ease: [0, 0, 0.2, 1] },
                      layout: { duration: 0.18, ease: [0.16, 1, 0.3, 1] },
                    }}
                    className={`pointer-events-auto relative w-max max-w-[min(588px,calc(100%_-_16px))] rounded-xl bg-background/75 p-2 shadow-lg ring-1 ring-sidebar-foreground/10 backdrop-blur-md`}
                    style={{ minWidth: DOCK_MIN_WIDTH }}
                  >
                    <SelectedPhotosDock
                      selected={selected}
                      onRemove={togglePhoto}
                    />
                    <div className="flex w-full items-center justify-between gap-4 px-0.5 pt-2">
                      <div className="flex items-center gap-3">
                        <Button
                          aria-label="Clear selected photos"
                          className="px-2.5"
                          onClick={() => setSelected([])}
                          size="sm"
                          variant="outline"
                        >
                          <XIcon />
                          Clear
                        </Button>
                        <span className="text-xs font-medium whitespace-nowrap text-sidebar-foreground">
                          <span className="font-mono tabular-nums">
                            {selected.length}
                          </span>{" "}
                          selected
                        </span>
                      </div>
                      <Button
                        aria-label={
                          createImage.isPending
                            ? "Adding photos…"
                            : "Add selected photos to board"
                        }
                        className="shrink-0 px-2.5"
                        disabled={createImage.isPending}
                        onClick={() => void addSelected()}
                        variant="default"
                        size="sm"
                      >
                        {createImage.isPending ? (
                          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <ImportIcon />
                        )}
                        {createImage.isPending ? "Adding…" : "Import"}
                      </Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
