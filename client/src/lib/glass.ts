export const GLASS_FRAME_CLASS =
  "border border-border/50 bg-background/30 shadow-lg ring-1 ring-foreground/10";

export const GLASS_SURFACE_CLASS =
  "border border-border/60 bg-background shadow-md ring-1 ring-foreground/10";

// Recreates the local dimmed, blurred backdrop that modal glass receives globally.
export const FLOATING_GLASS_BACKDROP_CLASS =
  "isolate before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:rounded-[calc(var(--radius-lg)-1px)] before:bg-black/10 before:supports-backdrop-filter:backdrop-blur-xs";
