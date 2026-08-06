import { useEffect, useState } from "react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { usePexelsSearch, type PexelsPhoto } from "@/api/pexels";
import { useCreateRemoteImage } from "@/api/collection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTransientStore } from "@/store";

export function PexelsBrowserPanel({
  workspaceSlug,
  collectionSlug,
  parentFolderPath,
}: {
  workspaceSlug: string;
  collectionSlug: string;
  parentFolderPath?: string;
}) {
  const close = useTransientStore((state) => state.setPexelsBrowserOpen);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PexelsPhoto[]>([]);
  const search = usePexelsSearch(workspaceSlug, query, page);
  const createImage = useCreateRemoteImage(workspaceSlug, collectionSlug);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);

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
    <aside className="flex h-full w-full shrink-0 flex-col border-l bg-sidebar md:w-[22rem]">
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Pexels photos</p>
          <p className="text-xs text-muted-foreground">
            Find a photo for this board
          </p>
        </div>
        <Button
          aria-label="Close Pexels browser"
          size="icon-sm"
          variant="ghost"
          onClick={() => close(false)}
        >
          <XIcon />
        </Button>
      </div>
      <div className="border-b p-3">
        <label className="relative block">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search photos"
            className="pl-8"
            autoFocus
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {query.length === 0 ? (
          <p className="px-1 pt-6 text-center text-sm text-muted-foreground">
            Search Pexels to start collecting.
          </p>
        ) : search.isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="aspect-[4/5] animate-pulse rounded-lg bg-muted"
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
          <div className="grid grid-cols-2 gap-2">
            {search.data?.results.map((photo) => {
              const isSelected = selected.some((item) => item.id === photo.id);
              return (
                <button
                  key={photo.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => togglePhoto(photo)}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border text-left focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary ring-2 ring-primary"
                      : "border-transparent",
                  )}
                >
                  <img
                    src={photo.urls.small}
                    alt={photo.alt ?? "Pexels photo"}
                    className="aspect-[4/5] w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pt-7 pb-1.5 text-[10px] text-white">
                    {photo.photographer.name}
                  </span>
                  {isSelected ? (
                    <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckIcon className="size-3" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
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
      <div className="border-t p-3">
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
    </aside>
  );
}
