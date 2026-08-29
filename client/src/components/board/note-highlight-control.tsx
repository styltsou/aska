import { BanIcon, EraserIcon, HighlighterIcon } from "lucide-react";
import { useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NOTE_HIGHLIGHT_COLORS,
  type NoteHighlightColor,
} from "@/lib/note-highlights";
import { cn } from "@/lib/utils";

export function NoteHighlightControl({
  editorRef,
  color,
  isHighlighting,
  canRemoveHighlight,
  onColorChange,
  onHighlightingChange,
}: {
  editorRef: RefObject<NoteRichTextHandle | null>;
  color?: NoteHighlightColor;
  isHighlighting: boolean;
  canRemoveHighlight: boolean;
  onColorChange: (color?: NoteHighlightColor) => void;
  onHighlightingChange: (active: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const isMarkerActive = isHighlighting && Boolean(color);
  const activeColor = NOTE_HIGHLIGHT_COLORS.find(
    (candidate) => candidate.value === color,
  );

  function selectColor(nextColor: NoteHighlightColor) {
    onColorChange(nextColor);
    const markdown = editorRef.current?.applyHighlight(nextColor);
    if (!markdown) onHighlightingChange(true);
    else if (!isHighlighting) onColorChange(undefined);
    setOpen(false);
  }

  function removeHighlight() {
    editorRef.current?.removeHighlight();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  className={cn(
                    "relative h-8 rounded-lg p-0 text-muted-foreground transition-[width,margin-left,background-color,color] duration-150 ease-out hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground",
                    isMarkerActive ? "-ml-5 w-13" : "w-8",
                    isHighlighting && "bg-secondary text-foreground",
                  )}
                  aria-label={
                    isHighlighting
                      ? `Highlighting with ${activeColor?.label ?? "selected color"}`
                      : "Highlight text"
                  }
                  aria-pressed={isHighlighting}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <AnimatePresence initial={false}>
                    {isMarkerActive ? (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.65, x: -3 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.65, x: -19 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute left-2 size-4 rounded-[3px]"
                        style={{
                          backgroundColor: `var(--note-highlight-${color})`,
                        }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </AnimatePresence>
                  <HighlighterIcon className="absolute right-2 size-4" />
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">
          {isHighlighting
            ? `Highlighting with ${activeColor?.label ?? "selected color"}`
            : "Highlight text"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        sideOffset={8}
        initialFocus={false}
        className="w-fit gap-1.5 rounded-xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl"
      >
        <PopoverHeader className="px-1.5 pt-1 pb-0.5">
          <PopoverTitle className="text-xs font-medium text-muted-foreground">
            Highlight color
          </PopoverTitle>
        </PopoverHeader>
        <div
          className="flex items-center justify-center gap-1 px-1"
          role="radiogroup"
          aria-label="Highlight color"
        >
          {NOTE_HIGHLIGHT_COLORS.map((candidate) => (
            <Tooltip key={candidate.value}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    role="radio"
                    aria-label={candidate.label}
                    aria-checked={candidate.value === color}
                    className={cn(
                      "size-8 rounded-lg border border-transparent transition-[filter,box-shadow] duration-100 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
                      candidate.value !== color &&
                        "hover:brightness-95 hover:ring-1 hover:ring-inset hover:ring-foreground/20 dark:hover:brightness-110",
                      candidate.value === color &&
                        "ring-2 ring-inset ring-foreground/35",
                    )}
                    style={{
                      backgroundColor: `var(--note-highlight-${candidate.value})`,
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectColor(candidate.value)}
                  />
                }
              />
              <TooltipContent>{candidate.label}</TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex">
                  <button
                    type="button"
                    aria-label="Stop highlighting"
                    disabled={!isHighlighting}
                    className="flex size-8 items-center justify-center rounded-lg border border-border/70 bg-secondary/40 text-muted-foreground transition-[border-color,background-color,color] duration-100 hover:border-border hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40 disabled:hover:border-border/70 disabled:hover:bg-secondary/40 disabled:hover:text-muted-foreground"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!isHighlighting) return;
                      onColorChange(undefined);
                      onHighlightingChange(false);
                      setOpen(false);
                    }}
                  >
                    <BanIcon className="size-3.5" />
                  </button>
                </span>
              }
            />
            <TooltipContent>Stop highlighting</TooltipContent>
          </Tooltip>
        </div>
        {canRemoveHighlight ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={removeHighlight}
          >
            <EraserIcon className="size-3.5" />
            Remove highlight
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
