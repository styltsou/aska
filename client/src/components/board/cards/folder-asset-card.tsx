import { FileText, FolderIcon } from "lucide-react";
import type { FolderAsset } from "@/types/asset";

import { useDroppable } from "@dnd-kit/react";

export function FolderAssetCard({ asset }: { asset: FolderAsset }) {
  const previews = asset.previews ?? [];
  const hasPreviews = previews.length > 0;

  const { ref } = useDroppable({ id: asset.id });

  return (
    <div
      ref={ref}
      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-sidebar transition-all hover:border-sidebar-foreground/20"
    >
      {hasPreviews ? (
        <div className="grid grid-cols-2 gap-3 p-3">
          {Array.from({ length: 4 }).map((_, i) => {
            const preview = previews[i];
            if (!preview) {
              return <div key={i} className="aspect-square rounded-sm bg-sidebar" />;
            }
            if (preview.type === "image" && preview.url) {
              return (
                <div key={i} className="aspect-square overflow-hidden rounded-sm">
                  <img src={preview.url} alt="" className="size-full object-cover" loading="lazy" />
                </div>
              );
            }
            return (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-sm"
                style={{ backgroundColor: preview.color ?? "var(--sidebar)" }}
              >
                <FileText className="size-5 text-sidebar-foreground/20" />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center px-3 pt-3">
          <div className="flex aspect-square w-full items-center justify-center rounded-sm border border-dashed border-sidebar-foreground/5">
            <span className="text-sm text-sidebar-foreground/15">Empty</span>
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-sidebar/60 px-3 py-2.5 backdrop-blur-sm transition-all group-hover:bg-sidebar/80">
        <FolderIcon className="size-5 shrink-0 text-sidebar-foreground" />
        <span className="truncate text-sm font-medium">{asset.name}</span>
        {asset.count !== undefined && (
          <span className="ml-auto text-xs text-sidebar-foreground/40">{asset.count}</span>
        )}
      </div>
    </div>
  );
}
