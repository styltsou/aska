import { BanIcon, PaletteIcon } from "lucide-react";
import { useState } from "react";

import { SimpleColorPicker } from "@/components/ui/color-picker";
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
import { cn } from "@/lib/utils";

const NOTE_COLORS = [
  { value: "#c77c55", label: "Clay" },
  { value: "#d9d4c8", label: "Sand" },
  { value: "#b9c7c2", label: "Sage" },
  { value: "#aebed1", label: "Sky" },
  { value: "#c5b2c9", label: "Lilac" },
] as const;

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function NoteColorControl({
  color,
  disabled = false,
  onColorChange,
}: {
  color?: string;
  disabled?: boolean;
  onColorChange: (color?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerColor = color && HEX_COLOR.test(color) ? color : undefined;

  function selectColor(nextColor?: string) {
    onColorChange(nextColor);
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
                  size="icon"
                  disabled={disabled}
                  className="relative size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground"
                  aria-label={color ? "Change note color" : "Set note color"}
                >
                  <PaletteIcon className="size-4" />
                  {color ? (
                    <span
                      className="absolute right-1 bottom-1 size-2.5 rounded-full border border-background shadow-sm"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  ) : null}
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">
          {color ? "Change note color" : "Set note color"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-64 gap-3 rounded-xl border-border/60 bg-background/95 p-3 shadow-xl backdrop-blur-xl"
      >
        <PopoverHeader className="gap-0 px-0.5">
          <PopoverTitle className="text-xs font-medium text-muted-foreground">
            Note color
          </PopoverTitle>
        </PopoverHeader>
        <div
          className="flex items-center gap-1.5"
          role="radiogroup"
          aria-label="Note color"
        >
          <button
            type="button"
            role="radio"
            aria-label="No note color"
            aria-checked={!color}
            disabled={disabled}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg border border-border/70 bg-secondary/40 text-muted-foreground transition-[border-color,background-color,color,transform] duration-100 hover:border-border hover:bg-secondary hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50",
              !color && "ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            onClick={() => selectColor()}
          >
            <BanIcon className="size-3.5" />
          </button>
          {NOTE_COLORS.map((candidate) => (
            <button
              key={candidate.value}
              type="button"
              role="radio"
              aria-label={candidate.label}
              aria-checked={candidate.value === color}
              disabled={disabled}
              className={cn(
                "size-8 rounded-lg border border-black/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] transition-[box-shadow,transform] duration-100 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50",
                candidate.value === color &&
                  "scale-90 ring-2 ring-ring ring-offset-1 ring-offset-background",
              )}
              style={{ backgroundColor: candidate.value }}
              onClick={() => selectColor(candidate.value)}
            />
          ))}
        </div>
        <div className="border-t border-border/60 pt-3">
          <SimpleColorPicker
            initialHex={pickerColor}
            onPick={selectColor}
            actionLabel="Apply"
            disabled={disabled}
            compact
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
