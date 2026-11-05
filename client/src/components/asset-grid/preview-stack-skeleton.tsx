import { ImageSkeleton } from "@/components/ui/image-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STACK_VARIANTS = [
  [
    { aspectRatio: 4 / 3, width: 0.9, x: -10, y: 6, rotation: -5 },
    { aspectRatio: 0.82, width: 0.7, x: 11, y: 5, rotation: 4 },
    { aspectRatio: 16 / 9, width: 1, x: 0, y: 0, rotation: -1 },
  ],
  [
    { aspectRatio: 1, width: 0.76, x: -11, y: 7, rotation: -4 },
    { aspectRatio: 3 / 2, width: 1, x: 10, y: 7, rotation: 5 },
    { aspectRatio: 4 / 5, width: 0.7, x: 0, y: 0, rotation: 1.5 },
  ],
  [
    { aspectRatio: 16 / 9, width: 1, x: -9, y: 8, rotation: -4 },
    { aspectRatio: 4 / 5, width: 0.68, x: 11, y: 4, rotation: 4 },
    { aspectRatio: 4 / 3, width: 0.92, x: 0, y: 0, rotation: 0 },
  ],
] as const;

type PreviewStackSkeletonProps = {
  variant?: number;
  maxWidthCqw?: number;
  maxHeightCqh?: number;
  centerY?: number;
};

export function PreviewStackSkeleton({
  variant = 0,
  maxWidthCqw = 65,
  maxHeightCqh = 52,
  centerY = 50,
}: PreviewStackSkeletonProps) {
  const layers = STACK_VARIANTS[variant % STACK_VARIANTS.length];

  return layers.map((layer, index) => {
    const widthCqw = maxWidthCqw * layer.width;
    const widthFromMaxHeightCqh = maxHeightCqh * layer.aspectRatio;
    return (
      <ImageSkeleton
        key={`${layer.aspectRatio}-${index}`}
        className="absolute left-1/2 rounded-lg shadow-sm ring-1 ring-border/30"
        style={{
          top: `${centerY}%`,
          zIndex: index + 1,
          width: `min(${widthCqw}cqw, ${widthFromMaxHeightCqh}cqh)`,
          aspectRatio: layer.aspectRatio,
          transform: `translate(calc(-50% + ${layer.x}cqw), calc(-50% + ${layer.y}cqh)) rotate(${layer.rotation}deg)`,
        }}
      />
    );
  });
}

export function FolderCardSkeleton({
  variant = 0,
  className,
}: {
  variant?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-lg border bg-sidebar",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ containerType: "size" }}
      >
        <PreviewStackSkeleton variant={variant} centerY={45} />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-linear-to-b from-sidebar/0 via-sidebar/85 to-sidebar px-3 pt-7 pb-2.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-3 w-5 shrink-0" />
      </div>
    </div>
  );
}
