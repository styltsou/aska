import { cn } from "@/lib/utils";

export const GLASS_FRAME_CLASS =
  "bg-popover/80 shadow-lg ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150";

export const GLASS_SURFACE_CLASS =
  "border border-border bg-background shadow-sm shadow-foreground/5";

export const GLASS_ISLAND_CLASS = cn(
  "relative z-10 rounded-md",
  GLASS_SURFACE_CLASS,
);

// Recreates the local dimmed, blurred backdrop that modal glass receives globally.
export const FLOATING_GLASS_BACKDROP_CLASS =
  "isolate before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:rounded-[calc(var(--radius-lg)-1px)] before:bg-black/10 before:supports-backdrop-filter:backdrop-blur-xs";
