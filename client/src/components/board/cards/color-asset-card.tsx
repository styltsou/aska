import { cn } from "@/lib/utils";
import { gradientToCss } from "@/lib/color-gradient";
import type { ColorAsset } from "@/types/asset";

export function ColorAssetCard({
  asset,
  isContextMenuOpen = false,
}: {
  asset: ColorAsset;
  isContextMenuOpen?: boolean;
}) {
  const hasAlpha = asset.hex.length === 9 && !asset.hex.endsWith("ff");
  const name = asset.title?.trim();
  const hex = asset.hex.toUpperCase();
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

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border bg-sidebar transition-all duration-100 hover:border-sidebar-foreground/20",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
    >
      <div
        className={cn(
          "aspect-square w-full rounded-b-[calc(var(--radius)-1px)]",
          hasAlpha &&
            "bg-size-[16px_16px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#ffffff_0_50%)]",
        )}
        style={surfaceStyle}
      />
      <div className="flex min-w-0 items-center gap-3 bg-sidebar px-4 py-3">
        <span
          className={cn(
            "truncate font-medium",
            name
              ? "text-base"
              : "font-mono text-lg font-semibold tracking-tight",
          )}
        >
          {name ?? hex}
        </span>
        {name ? (
          <span className="ml-auto shrink-0 font-mono text-sm font-semibold tracking-tight text-sidebar-foreground/70">
            {hex}
          </span>
        ) : null}
      </div>
    </div>
  );
}
