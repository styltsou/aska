import { ImageSkeleton } from "@/components/ui/image-skeleton";
import { Masonry } from "@/components/masonry-grid";
import { useRef, useState } from "react";
import { ASSET_SKELETONS } from "@/components/canvas/grid-view-loading";
import {
  ColorCardSkeleton,
  LinkCardSkeleton,
  NoteCardSkeleton,
} from "@/components/asset-card-skeleton";
import { useGridDensity } from "@/components/grid-density";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";

export function MasonryGridSkeleton() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const { density } = useGridDensity();
  useIsomorphicLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="relative"
      role="status"
      aria-label="Loading inbox"
    >
      <Masonry width={width} density={density}>
        {ASSET_SKELETONS.map((asset, i) =>
          asset.type === "note" ? (
            <NoteCardSkeleton key={i} variant={asset.variant} />
          ) : asset.type === "link" ? (
            <LinkCardSkeleton key={i} variant={asset.variant} />
          ) : asset.type === "color" ? (
            <ColorCardSkeleton key={i} />
          ) : (
            <ImageSkeleton
              key={i}
              className="w-full rounded-lg"
              style={{ aspectRatio: asset.aspectRatio }}
            />
          ),
        )}
      </Masonry>
    </div>
  );
}
