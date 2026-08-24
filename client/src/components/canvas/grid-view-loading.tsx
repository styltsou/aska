import { Masonry } from "@/components/masonry-grid";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const FOLDER_SKELETONS = 3;
const ASSET_SKELETONS = 12;
const ASSET_HEIGHTS = ["h-44", "h-56", "h-40", "h-64"] as const;

export function GridViewLoading() {
  return (
    <ScrollArea className="h-full min-h-0 w-full min-w-0 flex-1">
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
                <FolderSkeleton key={i} />
              ))}
            </div>
          </section>

          <section aria-hidden="true">
            <div className="mb-3 flex items-baseline gap-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-8" />
            </div>
            <Masonry className="min-w-0">
              {Array.from({ length: ASSET_SKELETONS }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={`w-full rounded-lg ${ASSET_HEIGHTS[i % ASSET_HEIGHTS.length]}`}
                />
              ))}
            </Masonry>
          </section>
        </div>
      </div>
    </ScrollArea>
  );
}

function FolderSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-sidebar">
      <div className="grid grid-cols-2 gap-3 p-3">
        <Skeleton className="aspect-square rounded-sm" />
        <Skeleton className="aspect-square rounded-sm" />
        <Skeleton className="aspect-square rounded-sm" />
        <Skeleton className="aspect-square rounded-sm" />
      </div>
      <div className="flex items-center gap-2 border-t bg-sidebar/80 px-3 py-2.5">
        <Skeleton className="size-5 shrink-0 rounded-sm" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-3 w-5" />
      </div>
    </div>
  );
}
