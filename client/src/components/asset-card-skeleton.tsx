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
      <ImageSkeleton className="aspect-video w-full rounded-t-none rounded-b-lg" />
      <div className="space-y-2 px-3 py-3">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-4 w-4/5" />
        {variant % 2 === 0 ? <Skeleton className="h-3 w-3/5" /> : null}
      </div>
    </div>
  );
}

export function ColorCardSkeleton() {
  return (
    <div className="flex aspect-[280/329] w-full flex-col overflow-hidden rounded-lg border bg-sidebar">
      <Skeleton className="min-h-0 w-full flex-1 rounded-t-none rounded-b-lg" />
      <div className="flex items-center gap-3 px-3 py-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-3 w-14" />
      </div>
    </div>
  );
}
