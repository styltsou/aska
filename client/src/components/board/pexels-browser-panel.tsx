import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { usePexelsSearch, type PexelsPhoto } from "@/api/pexels";
import { useCreateRemoteImage } from "@/api/collection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTransientStore } from "@/store";

const PEXELS_BROWSER_WIDTH_KEY = "pexels-browser-width";
const PEXELS_BROWSER_MIN_WIDTH = 420;
const PEXELS_BROWSER_MAX_WIDTH = 760;
const DEFAULT_PEXELS_BROWSER_WIDTH = 520;

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

function PexelsPhotoTile({
  photo,
  isSelected,
  onToggle,
}: {
  photo: PexelsPhoto;
  isSelected: boolean;
  onToggle: (photo: PexelsPhoto) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const credit = photo.alt ?? photo.photographer.name;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => onToggle(photo)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group/tile relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg border text-left focus-visible:ring-2 focus-visible:ring-ring",
        isSelected
          ? "border-primary ring-2 ring-primary"
          : "border-transparent",
      )}
    >
      <img
        src={photo.urls.small}
        alt={photo.alt ?? "Pexels photo"}
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        className="block w-full object-cover transition-transform duration-200 group-hover/tile:scale-[1.025]"
        loading="lazy"
      />
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5"
          >
            <span className="inline-flex max-w-full min-w-0 items-center rounded-lg bg-sidebar/70 px-3 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm">
              <span className="truncate">{credit}</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {isSelected ? (
        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckIcon className="size-3" />
        </span>
      ) : null}
    </button>
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
  const close = useTransientStore((state) => state.setPexelsBrowserOpen);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PexelsPhoto[]>([]);
  const [width, setWidth] = useState(getStoredBrowserWidth);
  const [isResizing, setIsResizing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const widthRef = useRef(width);
  const search = usePexelsSearch(workspaceSlug, query, page);
  const createImage = useCreateRemoteImage(workspaceSlug, collectionSlug);

  widthRef.current = width;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!open) return;
    searchInputRef.current?.focus();
  }, [open]);

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

  function togglePhoto(photo: PexelsPhoto) {
    setSelected((current) =>
      current.some((item) => item.id === photo.id)
        ? current.filter((item) => item.id !== photo.id)
        : [...current, photo],
    );
  }

  async function addSelected() {
    if (selected.length === 0) return;
    try {
      for (const photo of selected) {
        await createImage.mutateAsync({
          url: photo.urls.original,
          title: photo.alt ?? undefined,
          alt: photo.alt ?? undefined,
          parentFolderPath,
          provenance: {
            provider: "pexels",
            url: photo.url,
            downloadUrl: photo.urls.original,
            attribution: {
              photoId: photo.id,
              name: photo.photographer.name,
              profileUrl: photo.photographer.profileUrl,
            },
          },
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

  const totalPages = search.data
    ? Math.max(1, Math.ceil(search.data.totalResults / search.data.perPage))
    : 1;

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
            className="absolute top-1/2 left-0 z-20 hidden h-16 w-2 -translate-x-1/2 -translate-y-1/2 cursor-col-resize rounded-full bg-sidebar-foreground/35 transition-colors before:absolute before:-inset-x-2 before:-inset-y-4 before:content-[''] hover:bg-sidebar-foreground/50 active:bg-sidebar-foreground/60 md:block"
            role="separator"
            onPointerDown={handleResizeStart}
          />
          <div className="flex h-14 shrink-0 items-center gap-2 pr-0 pl-2 transition-[height] duration-120 ease-linear group-has-data-[state=collapsed]/sidebar-wrapper:h-12">
            <label className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Search photos"
                className="py-0 pl-8 text-sm"
              />
            </label>
            <Button
              aria-label="Close Pexels browser"
              size="icon-sm"
              variant="ghost"
              onClick={() => close(false)}
            >
              <XIcon />
            </Button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-3">
              {query.length === 0 ? (
                <p className="px-1 pt-6 text-center text-sm text-muted-foreground">
                  Search Pexels to start collecting.
                </p>
              ) : search.isLoading ? (
                <div className="columns-2 gap-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div
                      key={index}
                      className="mb-2 aspect-[4/5] animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              ) : search.isError ? (
                <p className="px-1 pt-6 text-center text-sm text-muted-foreground">
                  {search.error instanceof Error
                    ? search.error.message
                    : "Pexels search is unavailable."}
                </p>
              ) : search.data?.results.length === 0 ? (
                <p className="px-1 pt-6 text-center text-sm text-muted-foreground">
                  No photos found for “{query}”.
                </p>
              ) : (
                <div className="columns-2 gap-2">
                  {search.data?.results.map((photo) => (
                    <PexelsPhotoTile
                      key={photo.id}
                      photo={photo}
                      isSelected={selected.some((item) => item.id === photo.id)}
                      onToggle={togglePhoto}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          {query && totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2 border-t px-3 py-2">
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={page === totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}
          <div className="py-3 pr-0 pl-2">
            <Button
              className="w-full"
              disabled={selected.length === 0 || createImage.isPending}
              onClick={() => void addSelected()}
            >
              {createImage.isPending
                ? "Adding photos…"
                : selected.length
                  ? `Add ${selected.length} to board`
                  : "Select photos to add"}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Photos provided by{" "}
              <a
                className="underline underline-offset-2"
                href="https://www.pexels.com"
                target="_blank"
                rel="noreferrer"
              >
                Pexels
              </a>
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
