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
      className={cn(
        "pointer-events-none rounded-md bg-skeleton bg-[linear-gradient(110deg,var(--skeleton)_18%,color-mix(in_oklch,var(--skeleton)_92%,var(--foreground))_46%,var(--skeleton)_74%)] bg-[length:220%_100%] motion-safe:animate-image-shimmer",
        className,
      )}
      {...props}
    />
  );
}
