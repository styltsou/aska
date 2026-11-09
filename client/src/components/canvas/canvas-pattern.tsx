import { Background, BackgroundVariant } from "@xyflow/react";
import { useCallback, useSyncExternalStore } from "react";

export const CANVAS_PATTERNS = [
  { value: "none", label: "None" },
  { value: "dots", label: "Dots" },
  { value: "lines", label: "Lines" },
  { value: "cross", label: "Cross" },
] as const;

export type CanvasPattern = (typeof CANVAS_PATTERNS)[number]["value"];

export type CanvasPatternStyle = {
  variant: BackgroundVariant;
  gap: number;
  size?: number;
  lineWidth?: number;
  opacity: number;
};

const DEFAULT_CANVAS_PATTERN: CanvasPattern = "dots";
const STORAGE_KEY = "mnemee:canvas-pattern";
const CHANGE_EVENT = "mnemee:canvas-pattern-change";

export const CANVAS_PATTERN_STYLES: Record<
  Exclude<CanvasPattern, "none">,
  CanvasPatternStyle
> = {
  dots: {
    variant: BackgroundVariant.Dots,
    gap: 24,
    size: 1,
    opacity: 0.14,
  },
  lines: {
    variant: BackgroundVariant.Lines,
    gap: 24,
    lineWidth: 0.5,
    opacity: 0.06,
  },
  cross: {
    variant: BackgroundVariant.Cross,
    gap: 32,
    size: 5,
    lineWidth: 1,
    opacity: 0.07,
  },
};

export type CanvasPatternPreviewStyle = {
  gap: number;
  radius?: number;
  size?: number;
  lineWidth: number;
  opacity: number;
};

/**
 * Thumbnail-only values. The real patterns are too faint to read in a 48px
 * tile, so these are intentionally denser and stronger while keeping the
 * same relative weight between dots, lines, and crosses.
 */
export const CANVAS_PATTERN_PREVIEWS: Record<
  Exclude<CanvasPattern, "none">,
  CanvasPatternPreviewStyle
> = {
  dots: { gap: 14, radius: 1.1, lineWidth: 1, opacity: 0.35 },
  lines: { gap: 14, lineWidth: 1, opacity: 0.2 },
  cross: { gap: 18, size: 5, lineWidth: 1, opacity: 0.24 },
};

function isCanvasPattern(value: string | null): value is CanvasPattern {
  return CANVAS_PATTERNS.some((pattern) => pattern.value === value);
}

export function getSavedCanvasPattern(): CanvasPattern {
  if (typeof window === "undefined") return DEFAULT_CANVAS_PATTERN;

  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isCanvasPattern(saved) ? saved : DEFAULT_CANVAS_PATTERN;
}

function subscribeToCanvasPattern(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCanvasPattern() {
  const pattern = useSyncExternalStore<CanvasPattern>(
    subscribeToCanvasPattern,
    getSavedCanvasPattern,
    () => DEFAULT_CANVAS_PATTERN,
  );

  const setPattern = useCallback((next: CanvasPattern) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { pattern, setPattern };
}

export function CanvasBackground() {
  const { pattern } = useCanvasPattern();

  if (pattern === "none") return null;

  const style = CANVAS_PATTERN_STYLES[pattern];

  return (
    <Background
      variant={style.variant}
      gap={style.gap}
      size={style.size}
      lineWidth={style.lineWidth}
      color={`color-mix(in oklch, var(--foreground) ${Math.round(
        style.opacity * 100,
      )}%, transparent)`}
    />
  );
}
