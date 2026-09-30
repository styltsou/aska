import { Skeleton } from "@/components/ui/skeleton";

const collectionSkeletons = Array.from({ length: 8 }, (_, i) => i);
const previewLayers = [
  { x: -18, y: 6, rotation: -5 },
  { x: 14, y: 4, rotation: 4 },
  { x: -9, y: 2, rotation: -3 },
];

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
              {previewLayers.map((layer) => (
                <Skeleton
                  key={layer.x}
                  className="absolute top-1/2 left-1/2 aspect-[4/3] rounded-lg"
                  style={{
                    width: "min(60cqw, 72cqh)",
                    transform: `translate(calc(-50% + ${layer.x}cqw), calc(-50% + ${layer.y}cqh)) rotate(${layer.rotation}deg)`,
                  }}
                />
              ))}
              <div
                className="absolute top-1/2 left-1/2 flex flex-col rounded-lg border border-border bg-sidebar p-2"
                style={{
                  width: "min(64cqw, 62cqh)",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <Skeleton className="aspect-video w-full rounded-sm" />
                <Skeleton className="mt-2 h-2 w-3/4" />
                <Skeleton className="mt-1.5 h-2 w-full" />
                <Skeleton className="mt-1.5 h-2 w-5/6" />
              </div>
            </div>
            <div className="flex max-w-full items-center gap-5 rounded-md bg-sidebar px-3 py-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-3 w-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
