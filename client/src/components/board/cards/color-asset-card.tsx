import { cn } from "@/lib/utils";
import type { ColorAsset } from "@/types/asset";

export function ColorAssetCard({
  asset,
  isContextMenuOpen = false,
}: {
  asset: ColorAsset;
  isContextMenuOpen?: boolean;
}) {
  const hasAlpha = asset.hex.length === 9 && !asset.hex.endsWith("ff");
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-sidebar transition-all duration-100",
        isContextMenuOpen && "border-sidebar-foreground/20",
      )}
    >
      <div
        className={cn(
          "aspect-square w-full",
          hasAlpha &&
            "bg-size-[16px_16px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#ffffff_0_50%)]",
        )}
        style={{ backgroundColor: asset.hex }}
      />
      <div className="flex min-w-0 items-center gap-2 border-t bg-sidebar px-3 py-2.5">
        <span className="truncate text-sm font-medium">
          {asset.title ?? asset.hex.toUpperCase()}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-sidebar-foreground/45">
          {asset.hex.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
