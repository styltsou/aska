import { ImageSkeleton } from "@/components/ui/image-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function NoteCardSkeleton({
  className,
  variant = 0,
}: {
  className?: string;
  variant?: number;
}) {
  return (
    <div className={cn("w-full rounded-lg border bg-sidebar p-4", className)}>
      <Skeleton className="h-4 w-2/3" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/5" />
        {variant % 2 === 0 ? <Skeleton className="h-3 w-2/3" /> : null}
      </div>
    </div>
  );
}

export function LinkCardSkeleton({ variant = 0 }: { variant?: number }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-sidebar">
      <ImageSkeleton className="aspect-video w-full rounded-t-none rounded-b-lg border-b" />
      <div className="space-y-1 px-3 pt-3 pb-3">
        <div className="flex h-5 items-center gap-1.5">
          <Skeleton className="size-4.5 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-1.5 py-0.5">
          <Skeleton className="h-4 w-4/5" />
          {variant % 2 === 0 ? <Skeleton className="h-4 w-3/5" /> : null}
        </div>
      </div>
    </div>
  );
}

export function ColorCardSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-lg border bg-sidebar">
      <Skeleton className="aspect-square w-full rounded-t-none rounded-b-lg border-b" />
      <div className="flex items-center gap-3 p-3 leading-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-3 w-14" />
      </div>
    </div>
  );
}
