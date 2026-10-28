import { cn } from "@/lib/utils";

/** Placeholder for an image or other visual preview while its content loads. */
export function ImageSkeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="image-skeleton"
      className={cn("image-shimmer pointer-events-none rounded-md", className)}
      {...props}
    />
  );
}
