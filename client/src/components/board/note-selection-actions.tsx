import { HighlighterIcon, PackagePlusIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ComponentProps, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroupSeparator } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FLOATING_GLASS_BACKDROP_CLASS, GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

type NoteSelectionMenuSurfaceProps = ComponentProps<"div">;

/** A shared glass shell for the note editor's selection menu. */
export function NoteSelectionMenuSurface({
  children,
  className,
  ...props
}: NoteSelectionMenuSurfaceProps) {
  return (
    <div className={cn("relative w-fit", FLOATING_GLASS_BACKDROP_CLASS)}>
      <div
        className={cn(
          "relative z-10 rounded-lg p-1",
          GLASS_FRAME_CLASS,
          className,
        )}
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-1">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}

type NoteSelectionExtraActionsProps = {
  onExtract: () => void;
  onHighlight: () => void;
  isHighlightActive?: boolean;
  isHighlighting?: boolean;
};

/**
 * The note-specific actions intended to sit inside the editor's existing
 * formatting ButtonGroup. Keeping selection intact on press prevents the
 * active text range from disappearing before an action can use it.
 */
export function NoteSelectionExtraActions({
  onExtract,
  onHighlight,
  isHighlightActive = false,
  isHighlighting = false,
}: NoteSelectionExtraActionsProps) {
  const preserveSelection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Highlight selection"
              aria-pressed={isHighlightActive}
              className={cn(
                "text-foreground",
                isHighlightActive && "bg-accent text-foreground",
              )}
              disabled={isHighlighting}
              onMouseDown={preserveSelection}
              onClick={onHighlight}
            >
              <HighlighterIcon />
            </Button>
          }
        />
        <TooltipContent>
          {isHighlighting ? "Saving highlight…" : "Highlight"}
        </TooltipContent>
      </Tooltip>
      <ButtonGroupSeparator className="bg-border/70" />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Extract note"
              className="text-foreground"
              onMouseDown={preserveSelection}
              onClick={onExtract}
            >
              <PackagePlusIcon />
            </Button>
          }
        />
        <TooltipContent>Extract note</TooltipContent>
      </Tooltip>
    </>
  );
}
