import {
  ColorCardSkeleton,
  LinkCardSkeleton,
  NoteCardSkeleton,
} from "@/components/asset-card-skeleton";
import { Masonry } from "@/components/masonry-grid";
import { FolderCardSkeleton } from "@/components/preview-stack-skeleton";
import { ImageSkeleton } from "@/components/ui/image-skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const FOLDER_SKELETONS = 3;
const ASSET_SKELETONS = [
  { type: "image", aspectRatio: 4 / 3 },
  { type: "note", variant: 0 },
  { type: "image", aspectRatio: 4 / 5 },
  { type: "link", variant: 0 },
  { type: "image", aspectRatio: 16 / 9 },
  { type: "color" },
  { type: "note", variant: 1 },
  { type: "image", aspectRatio: 3 / 4 },
  { type: "link", variant: 1 },
  { type: "image", aspectRatio: 3 / 2 },
  { type: "image", aspectRatio: 4 / 5 },
  { type: "note", variant: 0 },
] as const;
export function GridViewLoading() {
  return (
    <ScrollArea
      className="h-full min-h-0 w-full min-w-0 flex-1"
      viewportClassName="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      verticalScrollbarClassName="w-[5px] p-0"
      verticalScrollbarStyle={{ top: 5, bottom: 5, right: 3 }}
    >
      <div
        className="p-5 pb-20"
        role="status"
        aria-label="Loading collection grid view"
      >
        <span className="sr-only">Loading collection grid view</span>

        <div className="w-full space-y-10">
          <section aria-hidden="true">
            <div className="mb-3 flex items-baseline gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-6" />
            </div>
            <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: FOLDER_SKELETONS }).map((_, i) => (
                <FolderCardSkeleton key={i} variant={i} />
              ))}
            </div>
          </section>

          <section aria-hidden="true">
            <div className="mb-3 flex items-baseline gap-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Masonry className="min-w-0">
              {ASSET_SKELETONS.map((asset, i) =>
                asset.type === "note" ? (
                  <NoteCardSkeleton key={i} variant={asset.variant} />
                ) : asset.type === "link" ? (
                  <LinkCardSkeleton key={i} variant={asset.variant} />
                ) : asset.type === "color" ? (
                  <ColorCardSkeleton key={i} />
                ) : (
                  <ImageSkeleton
                    key={i}
                    className="w-full rounded-lg"
                    style={{ aspectRatio: asset.aspectRatio }}
                  />
                ),
              )}
            </Masonry>
          </section>
        </div>
      </div>
    </ScrollArea>
  );
}
