import { cn } from "@/lib/utils";

export const GLASS_FRAME_CLASS =
  "bg-popover/80 shadow-none ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150";

export const GLASS_SURFACE_CLASS =
  "border border-border bg-background shadow-sm shadow-foreground/5";

export const GLASS_ISLAND_CLASS = cn(
  "relative z-10 rounded-md",
  GLASS_SURFACE_CLASS,
);

/** Translucent shell shared by compact option bars and menu-like controls. */
export const GLASS_OPTION_BAR_CLASS =
  "bg-popover/60 text-popover-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150";

/** A translucent semantic group surface for compact option and selection bars. */
export const GLASS_OPTION_ISLAND_CLASS =
  "relative z-10 rounded-md bg-popover/45 shadow-none ring-1 ring-foreground/10";

// Recreates the local dimmed, blurred backdrop that modal glass receives globally.
export const FLOATING_GLASS_BACKDROP_CLASS =
  "isolate before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:rounded-[calc(var(--radius-lg)-1px)] before:bg-black/10 before:supports-backdrop-filter:backdrop-blur-xs";
