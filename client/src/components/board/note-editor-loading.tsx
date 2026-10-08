import { Skeleton } from "@/components/ui/skeleton";

export function NoteEditorLoading() {
  return (
    <div className="py-8" role="status" aria-label="Opening note">
      <Skeleton className="h-9 w-[min(32rem,78%)] rounded-lg sm:h-10" />
      <div className="mt-2 space-y-2.5" aria-hidden="true">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-[92%]" />
        <Skeleton className="h-7 w-[68%]" />
        <div className="h-7" />
        <Skeleton className="h-7 w-[84%]" />
        <Skeleton className="h-7 w-[76%]" />
      </div>
    </div>
  );
}
