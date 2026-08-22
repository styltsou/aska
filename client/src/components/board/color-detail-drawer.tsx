import { useEffect, useMemo, useState } from "react";
import { CopyIcon, ImageIcon, LoaderCircleIcon } from "lucide-react";
import { toast } from "sonner";

import {
  type ColorSearchScope,
  useWeightedColorImageSearch,
} from "@/api/color-search";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { colorAssetToSearchColors } from "@/lib/color-asset-search";
import { gradientToCss } from "@/lib/color-gradient";
import type { ColorAsset, ImageAsset } from "@/types/asset";

const EMPTY_RESULTS: never[] = [];

export function ColorDetailDrawer({
  color,
  workspaceSlug,
  scope,
  onClose,
  onOpenImage,
}: {
  color: ColorAsset;
  workspaceSlug: string;
  scope: ColorSearchScope;
  onClose: () => void;
  onOpenImage: (image: ImageAsset) => void;
}) {
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const searchColors = useMemo(() => colorAssetToSearchColors(color), [color]);
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
  const hasGradient = color.gradient !== undefined && color.gradient !== null;
  const gradientCss = hasGradient
    ? gradientToCss(
        color.gradient?.stops ?? [
          { color: color.gradient!.from, position: 0 },
          { color: color.gradient!.to, position: 100 },
        ],
        color.gradient?.type ?? "linear",
        color.gradient?.angle,
      )
    : undefined;

  useEffect(() => setIncludeDescendants(false), [color.id]);

  function copyValue() {
    const value = gradientCss ?? color.hex;
    void navigator.clipboard
      .writeText(value)
      .then(() =>
        toast.success(hasGradient ? "Copied CSS gradient." : "Copied color."),
      )
      .catch(() => toast.error("Unable to copy color."));
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="gap-0 p-0 sm:max-w-md">
        <SheetHeader className="gap-3 border-b pr-12">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="size-11 shrink-0 rounded-lg border shadow-sm"
              style={
                gradientCss
                  ? { background: gradientCss }
                  : { backgroundColor: color.hex }
              }
            />
            <div className="min-w-0">
              <SheetTitle>
                {color.title?.trim() || color.hex.toUpperCase()}
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {hasGradient ? "Gradient" : color.hex.toUpperCase()}
              </SheetDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={copyValue}
          >
            <CopyIcon className="size-3.5" />
            {hasGradient ? "Copy CSS" : "Copy hex"}
          </Button>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {scope.type === "collection" ? (
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {includeDescendants ? "Entire collection" : "This view"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIncludeDescendants((current) => !current)}
              >
                {includeDescendants ? "Search this view" : "Search collection"}
              </Button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {search.isLoading || search.isSearching ? (
              <ColorResultsSkeleton />
            ) : search.isError ? (
              <ColorSearchError onRetry={() => void search.refetch()} />
            ) : results.length === 0 ? (
              <ColorSearchEmpty />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {results.map((result) => {
                  const location =
                    result.location.type === "collection" &&
                    result.location.folderNames.length > 0
                      ? result.location.folderNames.join(" / ")
                      : result.location.type === "collection"
                        ? "Collection root"
                        : "Inbox";
                  return (
                    <button
                      key={result.image.id}
                      type="button"
                      className="group min-w-0 text-left"
                      onClick={() => {
                        onClose();
                        onOpenImage({
                          id: result.image.id,
                          type: "image",
                          url: result.image.url,
                          width: result.image.width,
                          height: result.image.height,
                          title: result.image.title ?? undefined,
                          alt: result.image.alt ?? undefined,
                          blurDataURL: result.image.blurDataURL ?? undefined,
                          dominantColors: result.image.dominantColors,
                        });
                      }}
                    >
                      <img
                        src={result.image.url}
                        alt={
                          result.image.alt ??
                          result.image.title ??
                          "Color match"
                        }
                        width={result.image.width}
                        height={result.image.height}
                        className="aspect-square w-full rounded-lg border object-cover transition-opacity group-hover:opacity-80"
                      />
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {location}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ColorResultsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3" aria-label="Searching for images">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-1.5">
          <div className="aspect-square animate-pulse rounded-lg bg-muted" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
        </div>
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
