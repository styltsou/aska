import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-skeleton after:pointer-events-none after:absolute after:inset-0 after:content-[''] motion-safe:after:animate-skeleton-sweep motion-safe:after:bg-[linear-gradient(110deg,transparent_18%,color-mix(in_oklch,var(--foreground)_8%,transparent)_46%,transparent_74%)]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
