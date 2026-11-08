import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function ResizeGrip({
  className,
  sidebar = false,
  ...props
}: ComponentProps<"span"> & { sidebar?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 transition-[opacity,background-color] duration-150 group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 group-data-[resizing]/resize:!bg-primary group-data-[resizing]/resize:opacity-100 motion-reduce:transition-none",
        sidebar
          ? "bg-sidebar-foreground/35 group-hover/resize:bg-sidebar-foreground/50 group-focus-visible/resize:bg-sidebar-ring"
          : "bg-foreground/35 group-hover/resize:bg-foreground/50 group-focus-visible/resize:bg-ring",
        className,
      )}
      {...props}
    />
  );
}
