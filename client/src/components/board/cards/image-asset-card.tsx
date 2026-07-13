import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Transition } from "motion/react";
import { ExternalLink, LoaderCircleIcon } from "lucide-react";
import { ProgressiveImage } from "@/components/ui/progressive-image";
import type { ImageAsset } from "@/types/asset";

const imageTransition: Transition = { duration: 0.1, ease: [0.16, 1, 0.3, 1] };

export function ImageAssetCard({
  asset,
  onOpen,
}: {
  asset: ImageAsset;
  onOpen?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const hasBar = asset.title || asset.sourceLabel;
  const uploadLabel =
    asset.uploadStatus === "processing"
      ? "Processing"
      : `Uploading ${asset.uploadProgress ?? 0}%`;

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-transparent transition-all duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-sidebar-foreground/20"
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onOpen();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ProgressiveImage
        src={asset.url}
        blurDataURL={asset.uploadStatus ? undefined : asset.blurDataURL}
        alt={asset.alt ?? ""}
        className="absolute inset-0 h-full w-full object-cover"
        whileHover={{ scale: 1.05 }}
        transition={imageTransition}
        loading="lazy"
      />
      {asset.uploadStatus ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-popover/85 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
            <LoaderCircleIcon className="size-3 animate-spin" />
            <span>{uploadLabel}</span>
          </div>
        </div>
      ) : null}
      <AnimatePresence>
        {hovered && hasBar && !asset.uploadStatus && (
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5"
          >
            <div className="inline-flex items-center gap-2 rounded-lg bg-sidebar/70 px-3 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm">
              {asset.title && <span className="truncate">{asset.title}</span>}
              {asset.sourceLabel && (
                <>
                  {asset.title && (
                    <span className="text-sidebar-foreground/30">·</span>
                  )}
                  <a
                    href={asset.sourceUrl ?? asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 transition-colors duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-sidebar-foreground/70"
                  >
                    <ExternalLink className="size-3" />
                    {asset.sourceLabel}
                  </a>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
