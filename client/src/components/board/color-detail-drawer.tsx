import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckIcon,
  CopyIcon,
  ImageIcon,
  LoaderCircleIcon,
  PanelRightIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ProgressiveImage } from "@/components/ui/progressive-image";

import {
  type ColorSearchScope,
  useWeightedColorImageSearch,
} from "@/api/color-search";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { colorAssetToSearchColors } from "@/lib/color-asset-search";
import { gradientToCss } from "@/lib/color-gradient";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ColorAsset, ImageAsset } from "@/types/asset";
import { useWorkspacePeek } from "@/components/app-shell/workspace-peek";

const EMPTY_RESULTS: never[] = [];

export function ColorDetailDrawer({
  color,
  workspaceSlug,
  scope,
  onClose,
  onOpenImage,
  onEdit,
  open = color !== undefined,
}: {
  color?: ColorAsset;
  workspaceSlug: string;
  scope: ColorSearchScope;
  onClose: () => void;
  onOpenImage: (image: ImageAsset) => void;
  onEdit?: () => void;
  open?: boolean;
}) {
  const { peekColor } = useWorkspacePeek();
  const isMobile = useIsMobile();
  const [activeColor, setActiveColor] = useState<ColorAsset | undefined>(color);
  useEffect(() => {
    if (color) setActiveColor(color);
  }, [color]);
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchColors = useMemo(
    () => (activeColor ? colorAssetToSearchColors(activeColor) : []),
    [activeColor],
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
    activeColor?.gradient !== undefined && activeColor?.gradient !== null;
  const gradientCss = hasGradient
    ? gradientToCss(
        activeColor!.gradient?.stops ?? [
          { color: activeColor!.gradient!.from, position: 0 },
          { color: activeColor!.gradient!.to, position: 100 },
        ],
        activeColor!.gradient?.type ?? "linear",
        activeColor!.gradient?.angle ?? 90,
      )
    : undefined;

  useEffect(() => setIncludeDescendants(false), [activeColor?.id]);

  function copyValue() {
    const value = gradientCss ?? activeColor?.hex ?? "";
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

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      swipeDirection={isMobile ? "down" : "right"}
      fast
    >
      {activeColor ? (
        <DrawerContent
          className="max-h-[calc(100dvh-var(--app-shell-inset)-var(--app-shell-inset))] gap-0 rounded-xl! border-0! bg-background! p-0 text-foreground! shadow-none ring-1 ring-foreground/10"
          style={
            {
              "--drawer-content-width": "34rem",
              "--drawer-inset": "var(--app-shell-inset)",
              "--bleed": "0",
            } as unknown as CSSProperties
          }
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
                    : { backgroundColor: activeColor.hex }
                }
              >
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/0 text-white opacity-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] transition-[background-color,opacity] duration-75 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/swatch:bg-black/25 group-hover/swatch:opacity-100 focus-visible:bg-black/25 focus-visible:opacity-100"
                >
                  {copied ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </span>
              </button>
              <div className="min-w-0">
                <DrawerTitle className="truncate text-base leading-tight font-medium">
                  {activeColor.title?.trim() || activeColor.hex.toUpperCase()}
                </DrawerTitle>
                <DrawerDescription className="font-mono text-xs">
                  {hasGradient
                    ? `${activeColor.gradient?.type === "radial" ? "Radial" : "Linear"} gradient`
                    : activeColor.hex.toUpperCase()}
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
                  if (!activeColor) return;
                  peekColor(activeColor, effectiveScope);
                  onClose();
                }}
              >
                <PanelRightIcon className="size-4" />
              </Button>
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
              <DrawerClose
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Close" />
                }
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DrawerClose>
            </div>
          </DrawerHeader>

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
                              onClose();
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
      ) : null}
    </Drawer>
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
      <ProgressiveImage
        src={image.url}
        blurDataURL={image.blurDataURL ?? undefined}
        alt={image.alt ?? image.title ?? "Color match"}
        className="absolute inset-0 h-full w-full object-cover transition-all duration-300 ease-out group-hover/tile:scale-[1.025]"
        loading="lazy"
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
    <div className="columns-2 gap-3" aria-label="Searching for images">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="mb-3 animate-pulse break-inside-avoid rounded-lg bg-muted"
          style={{ aspectRatio: index % 2 === 0 ? "3 / 4" : "1 / 1" }}
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
