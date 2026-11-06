import { cn } from "@/lib/utils";

/** Placeholder for an image or other visual preview while its content loads. */
export function ImageSkeleton({
  as: Component = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "span" }) {
  return (
    <Component
      data-slot="image-skeleton"
      className={cn("image-shimmer pointer-events-none rounded-md", className)}
      {...props}
    />
  );
}
