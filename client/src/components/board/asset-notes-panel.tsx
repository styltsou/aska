import type { ReactNode } from "react";
import { NotebookPenIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS } from "@/components/board/asset-viewer-control-styles";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function AssetNotesButton({
  open,
  onClick,
  className,
  disabled = false,
}: {
  open: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "relative size-8 rounded-lg",
              ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
              className,
            )}
            aria-label={open ? "Close notes" : "Open notes"}
            aria-haspopup="true"
            aria-expanded={open}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        <NotebookPenIcon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {open ? "Close notes" : "Open notes"}
      </TooltipContent>
    </Tooltip>
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
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  transform: isMobile
                    ? "translate(0px, 12px)"
                    : "translate(12px, 0px)",
                }
          }
          animate={{ opacity: 1, transform: "translate(0px, 0px)" }}
          exit={
            reduceMotion
              ? undefined
              : {
                  opacity: 0,
                  transform: isMobile
                    ? "translate(0px, 12px)"
                    : "translate(12px, 0px)",
                }
          }
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease }}
          className={cn(
            "z-40 flex min-h-0 flex-col overflow-hidden",
            expanded
              ? "relative hidden w-80 shrink-0 border-l border-border bg-background md:flex"
              : cn(
                  "absolute inset-y-3 right-3 w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-border/70",
                  "bg-popover/80 text-popover-foreground shadow-[0_8px_24px_-8px_rgb(0_0_0_/_0.18)] backdrop-blur-2xl backdrop-saturate-150",
                ),
            "max-md:absolute max-md:inset-x-0 max-md:top-auto max-md:right-0 max-md:bottom-0 max-md:h-[min(65%,28rem)] max-md:w-full max-md:rounded-t-xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:border-t",
          )}
        >
          <header className="flex shrink-0 items-center justify-between pt-2 pr-2 pb-1 pl-4">
            <h2 className="text-sm font-medium">Notes</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-foreground/70 transition-colors hover:!bg-transparent hover:text-foreground focus-visible:!bg-transparent focus-visible:text-foreground active:!bg-transparent"
              aria-label="Close notes"
              onClick={onClose}
            >
              <XIcon className="size-4" />
            </Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {children}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
