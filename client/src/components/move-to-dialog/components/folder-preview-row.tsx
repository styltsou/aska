import { FolderIcon, Globe2Icon } from "lucide-react";

import type { FolderChildPreview } from "@/api/collection";
import { ProgressiveImage } from "@/components/ui/progressive-image";

export function FolderPreviewRow({
  previews,
}: {
  previews: FolderChildPreview[];
}) {
  const visible = previews.slice(0, 3);

  if (visible.length === 0) {
    return (
      <div className="flex size-8 shrink-0 items-center justify-center rounded bg-sidebar-foreground/5">
        <FolderIcon className="size-4 text-sidebar-foreground/35" />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 gap-0.5">
      {visible.map((preview) =>
        preview.type === "image" && preview.url ? (
          <div
            key={preview.assetId}
            className="size-8 shrink-0 overflow-hidden rounded-[3px] bg-muted"
          >
            <ProgressiveImage
              src={preview.url}
              blurDataURL={preview.blurDataURL}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          </div>
        ) : preview.type === "link" ? (
          <div
            key={preview.assetId}
            className="flex size-8 shrink-0 items-center justify-center rounded-[3px] border bg-card"
            title={preview.title ?? preview.hostname}
          >
            <Globe2Icon className="size-3.5 text-muted-foreground" />
          </div>
        ) : (
          <div
            key={preview.assetId}
            className="size-8 shrink-0 overflow-hidden rounded-[3px] border p-1 text-[5px] leading-tight text-foreground/45"
            style={
              preview.color ? { backgroundColor: preview.color } : undefined
            }
          >
            {preview.snippet?.slice(0, 42)}
          </div>
        ),
      )}
    </div>
  );
}
