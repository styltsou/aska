import { Skeleton } from "@/components/ui/skeleton";

const collectionSkeletons = Array.from({ length: 8 }, (_, i) => i);

export function CollectionGridSkeleton() {
  return (
    <div className="@container relative">
      <div className="grid grid-cols-1 gap-3 @min-[25rem]:grid-cols-2 @min-[38rem]:grid-cols-3 @min-[50rem]:grid-cols-4">
        {collectionSkeletons.map((item) => (
          <div
            key={item}
            className="grid aspect-square grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-sidebar"
          >
            <div className="relative flex min-h-0 items-center justify-center overflow-hidden bg-sidebar">
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
