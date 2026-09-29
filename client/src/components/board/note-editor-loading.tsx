import { Skeleton } from "@/components/ui/skeleton";

export function NoteEditorLoading() {
  return (
    <div className="py-8" role="status" aria-label="Opening note">
      <Skeleton className="h-10 w-[min(32rem,78%)] rounded-lg sm:h-11" />
      <div className="mt-20 space-y-3.5" aria-hidden="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[68%]" />
        <div className="h-4" />
        <Skeleton className="h-4 w-[84%]" />
        <Skeleton className="h-4 w-[76%]" />
      </div>
    </div>
  );
}
