import { cn } from "@/lib/utils";
import { CropIcon, FlipHorizontal2Icon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const ASPECT_RATIOS: { label: string; value: number }[] = [
  { label: "Free", value: 0 },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:2", value: 3 / 2 },
];

export function CropToolbar({
  aspect,
  zoom,
  onAspectChange,
  onZoomChange,
}: {
  aspect: number;
  zoom: number;
  onAspectChange: (aspect: number) => void;
  onZoomChange: (zoom: number) => void;
}) {
  return (
    <section className="space-y-5" aria-label="Edit image">
      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted-foreground">
          Tools
        </span>
        <ButtonGroup className="w-full">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            aria-pressed="true"
          >
            <CropIcon />
            Crop
          </Button>
          <ButtonGroupSeparator className="bg-border/70" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled
                />
              }
            >
              <RotateCcwIcon />
              Rotate
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
          <ButtonGroupSeparator className="bg-border/70" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled
                />
              }
            >
              <FlipHorizontal2Icon />
              Mirror
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted-foreground">
          Aspect ratio
        </span>
        <div className="flex flex-wrap gap-1">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio.label}
              type="button"
              onClick={() => onAspectChange(ratio.value)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                aspect === ratio.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Zoom</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        <Slider
          value={[zoom]}
          onValueChange={(v) => onZoomChange(Array.isArray(v) ? v[0] : v)}
          min={1}
          max={3}
          step={0.01}
        />
      </div>
    </section>
  );
}
