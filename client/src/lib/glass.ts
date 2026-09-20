import { cn } from "@/lib/utils";

export const GLASS_FRAME_CLASS =
  "bg-popover/80 shadow-none ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150";

export const GLASS_SURFACE_CLASS =
  "border border-border bg-background shadow-sm shadow-foreground/5";

export const GLASS_ISLAND_CLASS = cn(
  "relative z-10 rounded-md",
  GLASS_SURFACE_CLASS,
);

/**
 * Canonical floating material, based on the card context menu. Reuse this for
 * app menus and compact option bars so they read as one coherent layer.
 */
export const FLOATING_MENU_SURFACE_CLASS =
  "bg-popover/70 text-popover-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150";

/** Opaque panel used by controls that originate from a solid floating island. */
export const FLOATING_SOLID_PANEL_SURFACE_CLASS = cn(
  "text-foreground shadow-md shadow-foreground/10",
  GLASS_SURFACE_CLASS,
);

export type FloatingPanelSurface = "glass" | "solid";

/** Shared compact glass material for option bars and their panels. */
export const GLASS_OPTION_BAR_CLASS = cn(
  "isolate",
  FLOATING_MENU_SURFACE_CLASS,
);

/** Alias kept for existing canvas toolbar call sites. */
export const GLASS_OPTION_TOOLBAR_CLASS = GLASS_OPTION_BAR_CLASS;

// Recreates the local dimmed, blurred backdrop that modal glass receives globally.
export const FLOATING_GLASS_BACKDROP_CLASS =
  "isolate before:pointer-events-none before:absolute before:-inset-px before:-z-10 before:rounded-[calc(var(--radius-lg)-1px)] before:bg-black/10 before:supports-backdrop-filter:backdrop-blur-xs";

export const FLOATING_TOOLBAR_ENTER_TRANSITION = {
  duration: 0.08,
  ease: [0.22, 1, 0.36, 1] as const,
};

export const FLOATING_TOOLBAR_EXIT_TRANSITION = {
  duration: 0.15,
  ease: [0.22, 1, 0.36, 1] as const,
};
