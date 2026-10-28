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
            <div className="flex h-8 max-w-full items-center justify-center">
              <div className="flex h-full min-w-0 items-center gap-5 px-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
