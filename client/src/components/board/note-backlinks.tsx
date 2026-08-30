import { useEffect, useState } from "react";
import { ChevronRightIcon, FileTextIcon, LoaderCircleIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { useNoteBacklinks, useNoteBacklinkSummary } from "@/api/note-mentions";
import { cn } from "@/lib/utils";

const accordionTransition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
} as const;

export function NoteBacklinks({
  workspaceSlug,
  assetId,
  onOpen,
}: {
  workspaceSlug: string;
  assetId: string | undefined;
  onOpen: (assetId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [openingAssetId, setOpeningAssetId] = useState<string>();
  const reduceMotion = useReducedMotion();
  const summary = useNoteBacklinkSummary(workspaceSlug, assetId);
  const backlinks = useNoteBacklinks(workspaceSlug, assetId, Boolean(assetId));

  useEffect(() => {
    setOpen(false);
    setOpeningAssetId(undefined);
  }, [assetId]);

  const count = summary.data?.count ?? 0;
  if (!assetId || count === 0) return null;

  const contentId = `note-backlinks-${assetId}`;

  async function openBacklink(backlinkAssetId: string) {
    if (openingAssetId) return;
    setOpeningAssetId(backlinkAssetId);
    try {
      await onOpen(backlinkAssetId);
    } finally {
      setOpeningAssetId(undefined);
    }
  }

  return (
    <motion.div layout="size" transition={accordionTransition} className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className="group flex w-full items-center gap-1.5 rounded-md py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        <span>Referenced by {count}</span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={contentId}
            key="backlinks"
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : accordionTransition}
            className="overflow-hidden"
          >
            <motion.div
              layout="size"
              transition={accordionTransition}
              className="pt-2"
            >
              <div className="overflow-hidden rounded-md">
                {backlinks.isPending ? (
                  <div className="flex items-center gap-2 px-2.5 py-2 text-[11px] text-muted-foreground">
                    <LoaderCircleIcon className="size-3 animate-spin" />
                    <span>Loading references…</span>
                  </div>
                ) : backlinks.isError ? (
                  <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
                    Could not load references.
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {backlinks.data?.backlinks.map((backlink) => {
                      const isOpening = openingAssetId === backlink.assetId;
                      return (
                        <button
                          key={backlink.assetId}
                          type="button"
                          disabled={Boolean(openingAssetId)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-wait"
                          onClick={() => void openBacklink(backlink.assetId)}
                        >
                          {isOpening ? (
                            <LoaderCircleIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                          ) : (
                            <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                            {backlink.title}
                          </span>
                          <span className="max-w-32 truncate pl-3 text-[11px] text-muted-foreground">
                            {backlink.locationLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
