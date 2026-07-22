import { Skeleton } from "@/components/ui/skeleton";

const collectionSkeletons = Array.from({ length: 8 }, (_, i) => i);

export function CollectionGridSkeleton() {
  return (
    <div className="relative">
      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-3 max-sm:grid-cols-2">
        {collectionSkeletons.map((item) => (
          <div
            key={item}
            className="overflow-hidden rounded-lg border bg-sidebar"
          >
            <div className="relative flex aspect-3/2 items-center justify-center overflow-hidden bg-sidebar">
              <Skeleton className="absolute h-3/5 w-3/5 translate-x-1 translate-y-2 rotate-2 rounded-xl" />
              <Skeleton className="absolute h-3/5 w-3/5 -translate-x-1 -translate-y-1 -rotate-2 rounded-xl" />
            </div>
            <div className="flex items-center gap-2 bg-sidebar px-3 py-2.5">
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-3 w-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
