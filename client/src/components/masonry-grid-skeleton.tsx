import { ImageSkeleton } from "@/components/ui/image-skeleton";
import { Masonry } from "@/components/masonry-grid";

const masonrySkeletonHeights = [
  260, 132, 190, 300, 170, 224, 150, 260, 210, 300, 170, 224,
];

export function MasonryGridSkeleton() {
  return (
    <div className="relative">
      <Masonry>
        {masonrySkeletonHeights.map((height, i) => (
          <ImageSkeleton
            key={i}
            className="w-full rounded-lg"
            style={{ height }}
          />
        ))}
      </Masonry>
    </div>
  );
}
