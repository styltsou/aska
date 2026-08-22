import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { gradientToCss } from "@/lib/color-gradient";
import type { ColorAsset } from "@/types/asset";

export function ColorAssetCard({
  asset,
  isContextMenuOpen = false,
  onOpen,
}: {
  asset: ColorAsset;
  isContextMenuOpen?: boolean;
  onOpen?: () => void;
}) {
  const [surfaceHovered, setSurfaceHovered] = useState(false);
  const hasAlpha = asset.hex.length === 9 && !asset.hex.endsWith("ff");
  const name = asset.title?.trim();
  const hex = asset.hex.toUpperCase();
  const gradientLabel = asset.gradient
    ? `${asset.gradient.type === "radial" ? "Radial" : "Linear"} gradient`
    : null;
  const surfaceStyle = asset.gradient
    ? {
        background: gradientToCss(
          asset.gradient.stops ?? [
            { color: asset.gradient.from, position: 0 },
            { color: asset.gradient.to, position: 100 },
          ],
          asset.gradient.type ?? "linear",
          asset.gradient.angle,
        ),
      }
    : { backgroundColor: asset.hex };
  const copiedValue = asset.gradient
    ? gradientToCss(
        asset.gradient.stops ?? [
          { color: asset.gradient.from, position: 0 },
          { color: asset.gradient.to, position: 100 },
        ],
        asset.gradient.type ?? "linear",
        asset.gradient.angle,
      )
    : asset.hex;
  const copyLabel = asset.gradient ? "Copy CSS gradient" : "Copy hex color";

  async function copyColorValue() {
    try {
      await navigator.clipboard.writeText(copiedValue);
      toast.success(asset.gradient ? "Copied CSS gradient." : "Copied color.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to copy color.",
      );
    }
  }

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border bg-sidebar transition-all duration-100 hover:border-sidebar-foreground/20",
        onOpen && "cursor-pointer",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
      onMouseEnter={() => setSurfaceHovered(true)}
      onMouseLeave={() => setSurfaceHovered(false)}
    >
      {onOpen ? (
        <button
          type="button"
          className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label={`Open ${name ?? gradientLabel ?? hex}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        />
      ) : null}
      <div
        className={cn(
          "group/surface pointer-events-none relative z-10 aspect-square w-full overflow-hidden rounded-b-[calc(var(--radius)-1px)]",
          hasAlpha &&
            "bg-size-[16px_16px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#ffffff_0_50%)]",
        )}
        style={surfaceStyle}
      >
        <AnimatePresence>
          {surfaceHovered ? (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-2.5 pb-2.5"
            >
              <button
                type="button"
                className="pointer-events-auto inline-flex items-center rounded-lg border border-sidebar-foreground/10 bg-sidebar/60 px-3 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-sidebar/90 hover:ring-1 hover:ring-sidebar-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={(event) => {
                  event.stopPropagation();
                  void copyColorValue();
                }}
                aria-label={copyLabel}
                title={copyLabel}
              >
                {asset.gradient ? "Copy CSS" : "Copy hex"}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-3 bg-sidebar px-4 py-3">
        <span
          className={cn(
            "truncate font-medium",
            name || gradientLabel
              ? "text-base"
              : "font-mono text-lg font-semibold tracking-tight",
          )}
        >
          {name ?? gradientLabel ?? hex}
        </span>
        {name && !gradientLabel ? (
          <span className="ml-auto shrink-0 font-mono text-sm font-semibold tracking-tight text-sidebar-foreground/70">
            {hex}
          </span>
        ) : null}
      </div>
    </div>
  );
}
