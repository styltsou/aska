import { PreviewStackSkeleton } from "@/components/preview-stack-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const collectionSkeletons = Array.from({ length: 8 }, (_, i) => i);

export function CollectionGridSkeleton() {
  return (
    <div className="@container relative">
      <div className="grid grid-cols-1 gap-4 @min-[38rem]:grid-cols-2 @min-[64rem]:grid-cols-3 @min-[120rem]:grid-cols-4">
        {collectionSkeletons.map((item) => (
          <div
            key={item}
            className="flex min-w-0 flex-col items-center gap-2.5 rounded-xl p-1.5"
          >
            <div
              className="relative aspect-[3/2] w-full @min-[64rem]:max-h-[calc((100svh-13.75rem)/2)]"
              style={{ containerType: "size" }}
            >
              <PreviewStackSkeleton
                variant={item}
                maxWidthCqw={60}
                maxHeightCqh={72}
              />
            </div>
            <div className="flex max-w-full items-center gap-1.5">
              <Skeleton className="h-8 w-32 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
