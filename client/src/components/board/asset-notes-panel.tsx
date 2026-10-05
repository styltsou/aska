import type { ReactNode } from "react";
import { NotebookPenIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS } from "@/components/board/asset-viewer-control-styles";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { FLOATING_MENU_SURFACE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

export function AssetNotesButton({
  hasNote,
  open,
  onClick,
  className,
}: {
  hasNote: boolean;
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "relative size-8 rounded-lg",
        ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
        className,
      )}
      aria-label={hasNote ? "Open notes; this asset has a note" : "Open notes"}
      aria-haspopup="true"
      aria-expanded={open}
      onClick={onClick}
    >
      <NotebookPenIcon className="size-4" />
      {hasNote ? (
        <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
      ) : null}
    </Button>
  );
}

export function AssetNotesPanel({
  open,
  expanded,
  onClose,
  children,
}: {
  open: boolean;
  expanded: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.aside
          key="asset-notes-panel"
          aria-label="Asset notes"
          onKeyDownCapture={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }}
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  x: isMobile ? 0 : 16,
                  y: isMobile ? 16 : 0,
                }
          }
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={
            reduceMotion
              ? undefined
              : {
                  opacity: 0,
                  x: isMobile ? 0 : 10,
                  y: isMobile ? 10 : 0,
                  transition: { duration: 0.35, ease },
                }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease }}
          className={cn(
            "z-40 flex min-h-0 flex-col overflow-hidden",
            expanded
              ? "relative hidden w-80 shrink-0 border-l border-border bg-background md:flex"
              : cn(
                  "absolute inset-y-3 right-3 w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-border/70",
                  FLOATING_MENU_SURFACE_CLASS,
                ),
            "max-md:absolute max-md:inset-x-0 max-md:top-auto max-md:right-0 max-md:bottom-0 max-md:h-[min(65%,28rem)] max-md:w-full max-md:rounded-t-xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:border-t",
          )}
        >
          <header className="flex h-12 shrink-0 items-center justify-between px-4">
            <h2 className="text-sm font-medium">Notes</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-lg",
                ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
              )}
              aria-label="Close notes"
              onClick={onClose}
            >
              <XIcon className="size-4" />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
            {children}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
