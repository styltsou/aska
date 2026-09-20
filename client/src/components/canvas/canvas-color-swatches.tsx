import { useEffect, useState } from "react";
import { PlusIcon } from "lucide-react";

import type { CanvasObjectColor } from "@/api/collection";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CANVAS_OBJECT_OVERFLOW_COLORS,
  CANVAS_OBJECT_VISIBLE_COLORS,
  canvasObjectColor,
  canvasObjectColorMarker,
} from "./canvas-object-style";

type CanvasColorSwatchesProps = {
  value: CanvasObjectColor;
  onChange: (color: CanvasObjectColor) => void;
  ariaLabel: string;
  /** Changes when a canvas viewport interaction should dismiss the popover. */
  dismissKey?: number;
};

export function CanvasColorSwatches({
  value,
  onChange,
  ariaLabel,
  dismissKey,
}: CanvasColorSwatchesProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const overflowColor = CANVAS_OBJECT_OVERFLOW_COLORS.includes(value)
    ? value
    : undefined;

  useEffect(() => {
    setMoreOpen(false);
  }, [dismissKey]);

  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={ariaLabel}
    >
      {CANVAS_OBJECT_VISIBLE_COLORS.map((color) => (
        <CanvasColorSwatch
          key={color}
          color={color}
          selected={value === color}
          onClick={() => onChange(color)}
        />
      ))}

      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className={cn(
                "relative flex size-[18px] items-center justify-center rounded-[5px] transition-[background,transform,box-shadow] duration-100 hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                overflowColor
                  ? "ring-1 ring-black/15 ring-inset dark:ring-white/20"
                  : "bg-foreground/5 ring-1 ring-foreground/10 ring-inset hover:bg-foreground/10",
              )}
            />
          }
          aria-label={
            overflowColor
              ? `More colors, ${colorLabel(overflowColor)} selected`
              : "More colors"
          }
        >
          {overflowColor ? (
            <>
              <span
                className="absolute inset-0 rounded-[inherit]"
                style={{ backgroundColor: canvasObjectColor(overflowColor) }}
              />
              <span className="absolute right-0.5 bottom-0.5 flex size-2.5 items-center justify-center rounded-[2px] bg-popover/90 text-foreground shadow-sm ring-1 ring-foreground/15">
                <PlusIcon className="size-2" strokeWidth={2.5} />
              </span>
            </>
          ) : (
            <PlusIcon className="size-3 text-foreground" strokeWidth={2} />
          )}
          <SwatchSelectionMark
            color={overflowColor ?? "ink"}
            selected={Boolean(overflowColor)}
          />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-auto min-w-0 gap-0 p-2"
        >
          <div
            className="grid grid-cols-4 gap-1.5"
            role="group"
            aria-label="More colors"
          >
            {CANVAS_OBJECT_OVERFLOW_COLORS.map((color) => (
              <CanvasColorSwatch
                key={color}
                color={color}
                selected={value === color}
                onClick={() => {
                  onChange(color);
                  setMoreOpen(false);
                }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function CanvasColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: CanvasObjectColor;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="relative size-[18px] rounded-[5px] ring-1 ring-black/15 transition-transform duration-100 ring-inset hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none dark:ring-white/20"
      style={{ backgroundColor: canvasObjectColor(color) }}
      aria-label={`${colorLabel(color)}${selected ? ", selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      <SwatchSelectionMark color={color} selected={selected} />
    </button>
  );
}

function SwatchSelectionMark({
  color,
  selected,
}: {
  color: CanvasObjectColor;
  selected: boolean;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 m-auto size-2.5 rounded-[3px] transition-opacity duration-150 ease-out motion-reduce:transition-none",
        selected ? "opacity-100" : "opacity-0",
      )}
      style={{ backgroundColor: canvasObjectColorMarker(color) }}
    />
  );
}

function colorLabel(color: CanvasObjectColor) {
  return color.charAt(0).toUpperCase() + color.slice(1);
}
