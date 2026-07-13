import { FolderIcon } from "lucide-react";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import { cn } from "@/lib/utils";
import type { FolderAsset } from "@/types/asset";

import { NoteMarkdown } from "./note-asset-card";

import { useDroppable } from "@dnd-kit/react";

export function FolderAssetCard({
  asset,
  onOpen,
}: {
  asset: FolderAsset;
  onOpen?: () => void;
}) {
  const previews = asset.previews ?? [];
  const hasPreviews = previews.length > 0;

  const { ref } = useDroppable({ id: asset.id });

  return (
    <div
      ref={ref}
      className="group relative cursor-pointer overflow-hidden rounded-lg border bg-sidebar transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      role={onOpen ? "link" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onOpen();
      }}
    >
      {hasPreviews ? (
        <div className="grid grid-cols-2 gap-3 p-3">
          {Array.from({ length: 4 }).map((_, i) => {
            const preview = previews[i];
            if (!preview) {
              return (
                <div key={i} className="aspect-square rounded-sm bg-sidebar" />
              );
            }
            if (preview.type === "image" && preview.url) {
              return (
                <div
                  key={preview.assetId}
                  className="aspect-square overflow-hidden rounded-sm"
                >
                  <ProgressiveImage
                    src={preview.url}
                    blurDataURL={preview.blurDataURL}
                    alt=""
                    className="size-full object-cover"
                    loading="lazy"
                  />
                </div>
              );
            }
            return (
              <div
                key={preview.assetId}
                className={cn(
                  "flex aspect-square flex-col items-start justify-start gap-0.5 overflow-hidden rounded-sm px-2 pt-2 pb-0",
                  !preview.color && "bg-card",
                )}
                style={
                  preview.color ? { backgroundColor: preview.color } : undefined
                }
              >
                {preview.snippet ? (
                  <NoteMarkdown
                    content={preview.snippet}
                    className="text-[11px] leading-[1.2] [&_a]:!text-[11px] [&_blockquote]:!text-[11px] [&_code]:!text-[11px] [&_h1]:!my-0 [&_h1]:!text-[11px] [&_h2]:!my-0 [&_h2]:!text-[11px] [&_h3]:!my-0 [&_h3]:!text-[11px] [&_li]:!my-0 [&_li]:!text-[11px] [&_ol]:!my-0 [&_p]:!my-0 [&_p]:!text-[11px] [&_pre]:!text-[11px] [&_ul]:!my-0"
                  />
                ) : (
                  <span className="text-[10px] font-medium text-sidebar-foreground/20">
                    Note
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center px-3 pt-3">
          <div className="flex aspect-square w-full items-center justify-center rounded-sm bg-sidebar-foreground/2.5">
            <FolderIcon className="size-9 text-sidebar-foreground/10" />
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-sidebar/60 px-3 py-2.5 backdrop-blur-sm transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-sidebar/80">
        <FolderIcon className="size-5 shrink-0 text-sidebar-foreground" />
        <span className="truncate text-sm font-medium">{asset.name}</span>
        {asset.count !== undefined && (
          <span className="ml-auto text-xs text-sidebar-foreground/40">
            {asset.count}
          </span>
        )}
      </div>
    </div>
  );
}
