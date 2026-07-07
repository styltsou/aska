import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink } from "lucide-react";
import type { ImageAsset } from "@/types/asset";

export function ImageAssetCard({ asset }: { asset: ImageAsset }) {
  const [hovered, setHovered] = useState(false);
  const hasBar = asset.title || asset.sourceLabel;

  return (
    <div
      className="group relative cursor-pointer overflow-hidden rounded-lg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={asset.url} alt={asset.alt ?? ""} className="w-full" loading="lazy" />
      <AnimatePresence>
        {hovered && hasBar && (
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5"
          >
            <div className="inline-flex items-center gap-2 rounded-lg bg-sidebar/70 px-3 py-1.5 text-xs font-medium text-sidebar-foreground backdrop-blur-sm">
              {asset.title && <span className="truncate">{asset.title}</span>}
              {asset.sourceLabel && (
                <>
                  {asset.title && <span className="text-sidebar-foreground/30">·</span>}
                  <a
                    href={asset.sourceUrl ?? asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors hover:text-sidebar-foreground/70"
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
