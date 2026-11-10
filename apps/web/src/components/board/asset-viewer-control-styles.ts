export const ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS =
  "shrink-0 text-foreground transition-[background,color,box-shadow] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:!bg-foreground/10 active:not-disabled:!bg-foreground/15 aria-expanded:!bg-foreground/15 aria-pressed:!bg-foreground/15 data-popup-open:!bg-foreground/15 dark:hover:!bg-foreground/15 dark:active:not-disabled:!bg-foreground/20 dark:aria-expanded:!bg-foreground/20 dark:aria-pressed:!bg-foreground/20 dark:data-popup-open:!bg-foreground/20";

// For buttons that latch a mode rather than fire once — the highlighter, the
// eyedropper. They keep the quiet `secondary` wash of a ghost button instead of
// the header's foreground fill: `secondary` reads as barely-there in light mode,
// so a switch left on stays quiet rather than looking stuck-on.
export const ASSET_VIEWER_HEADER_ICON_TOGGLE_BUTTON_CLASS = `${ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS} aria-pressed:!bg-secondary dark:aria-pressed:!bg-secondary/50`;
