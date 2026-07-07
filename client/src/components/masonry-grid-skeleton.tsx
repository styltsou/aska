import { Skeleton } from "@/components/ui/skeleton";

const masonrySkeletonHeights = [
  260, 132, 190, 300, 170, 224, 150, 260, 210, 300, 170, 224, 280, 190, 244,
  170, 260, 210, 132, 224, 180, 280, 190, 244,
];

export function MasonryGridSkeleton() {
  return (
    <div className="relative">
      <div className="columns-6 gap-2.5 *:mb-2.5 *:break-inside-avoid max-md:columns-4 max-sm:columns-2">
        {masonrySkeletonHeights.map((height, i) => {
          const isNote = i % 3 === 1;
          const isFolder = i % 7 === 2;

          if (isNote) {
            return (
              <div key={i} className="rounded-lg border bg-sidebar p-4">
                <Skeleton className="mb-2 h-3 w-11/12" />
                <Skeleton className="mb-2 h-3 w-full" />
                <Skeleton className="mb-2 h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            );
          }

          if (isFolder) {
            return (
              <div key={i} className="overflow-hidden rounded-lg border bg-sidebar">
                <div className="grid grid-cols-2 gap-3 p-3">
                  <Skeleton className="aspect-square rounded-sm" />
                  <Skeleton className="aspect-square rounded-sm" />
                  <Skeleton className="aspect-square rounded-sm" />
                  <Skeleton className="aspect-square rounded-sm" />
                </div>
                <div className="flex items-center gap-2 bg-sidebar/60 px-3 py-2.5">
                  <Skeleton className="size-5 shrink-0 rounded-sm" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="ml-auto h-3 w-4" />
                </div>
              </div>
            );
          }

          return (
            <Skeleton
              key={i}
              className="w-full rounded-lg"
              style={{ height }}
            />
          );
        })}
      </div>
    </div>
  );
}
