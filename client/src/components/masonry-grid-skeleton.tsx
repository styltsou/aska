import { Skeleton } from "@/components/ui/skeleton";

const masonrySkeletonHeights = [
  260, 132, 190, 300, 170, 224, 150, 260, 210, 300, 170, 224,
];

export function MasonryGridSkeleton() {
  return (
    <div className="relative">
      <div className="columns-6 gap-2.5 *:mb-2.5 *:break-inside-avoid max-md:columns-4 max-sm:columns-2">
        {masonrySkeletonHeights.map((height, i) => {
          const isNote = i % 3 === 1;

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
