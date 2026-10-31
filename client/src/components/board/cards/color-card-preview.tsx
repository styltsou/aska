import type { CSSProperties } from "react";
import type { ColorGradient } from "@/api/collection/types";
import { resolveGradientCss } from "@/lib/color-gradient";
import { cn } from "@/lib/utils";

/** Matches the 280 × 329 canvas color-card footprint. */
export const COLOR_CARD_PREVIEW_ASPECT_RATIO = 280 / 329;

export function ColorCardPreview({
  hex,
  gradient,
  title,
  textScale = 1,
}: {
  hex?: string | null;
  gradient?: ColorGradient | null;
  title?: string | null;
  /** Multiplier for the footer name/hex font size, for mini previews (stacks). */
  textScale?: number;
}) {
  const name = title?.trim();
  const displayHex = hex?.toUpperCase();
  const label = name ?? (gradient ? "Color" : (displayHex ?? "Color"));
  const hasAlpha = Boolean(hex && hex.length === 9 && !hex.endsWith("ff"));

  return (
    <div
      data-color-card-preview
      className="flex size-full min-h-0 flex-col bg-sidebar text-sidebar-foreground"
      style={{ "--color-card-text-scale": textScale } as CSSProperties}
    >
      <div
        data-color-card-preview-swatch
        className={cn(
          "relative z-10 min-h-0 w-full flex-1 overflow-hidden rounded-b-lg border-b border-border",
          hasAlpha &&
            "bg-size-[16px_16px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#ffffff_0_50%)]",
        )}
        style={
          gradient
            ? { background: resolveGradientCss(gradient) }
            : { backgroundColor: hex ?? "transparent" }
        }
      />
      <div className="relative z-0 flex min-w-0 items-baseline gap-[4.3%] bg-sidebar px-[4.3%] py-[4.3%] text-[clamp(0.625rem,calc(4.6cqw*var(--color-card-text-scale,1)),calc(1rem*var(--color-card-text-scale,1)))] leading-tight">
        <span
          className={cn(
            "min-w-0 truncate font-medium",
            !name && displayHex && "font-mono font-semibold tracking-tight",
          )}
        >
          {label}
        </span>
        {name && !gradient ? (
          <span className="ml-auto shrink-0 font-mono text-[0.8125em] font-normal tracking-wide text-sidebar-foreground/60">
            {displayHex}
          </span>
        ) : null}
      </div>
    </div>
  );
}
