import { Skeleton } from "@/components/ui/skeleton";
import { Masonry } from "@/components/masonry-grid";

const masonrySkeletonHeights = [
  260, 132, 190, 300, 170, 224, 150, 260, 210, 300, 170, 224,
];

export function MasonryGridSkeleton() {
  return (
    <div className="relative">
      <Masonry>
        {masonrySkeletonHeights.map((height, i) => {
          if (i % 3 === 1) {
            return (
              <Skeleton
                key={i}
                className="w-full rounded-lg"
                style={{ height }}
              />
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
      </Masonry>
    </div>
  );
}
