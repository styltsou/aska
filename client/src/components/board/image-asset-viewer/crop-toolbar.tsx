import {
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  Redo2Icon,
  RotateCcwIcon,
  RotateCwIcon,
  Undo2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  flipX,
  flipY,
  onAspectChange,
  onZoomChange,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
}: {
  aspect: number;
  zoom: number;
  flipX: boolean;
  flipY: boolean;
  onAspectChange: (aspect: number) => void;
  onZoomChange: (zoom: number) => void;
  onRotate: (direction: "clockwise" | "counterclockwise") => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
}) {
  return (
    <section className="space-y-5" aria-label="Edit image controls">
      <div className="flex items-center justify-between">
        <ButtonGroup className="overflow-hidden rounded-lg border border-border/70 bg-background/65 shadow-[0_1px_1px_rgb(0_0_0_/_0.04)]">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Rotate 90 degrees counterclockwise"
                  onClick={() => onRotate("counterclockwise")}
                />
              }
            >
              <RotateCcwIcon />
            </TooltipTrigger>
            <TooltipContent>Rotate 90° counterclockwise</TooltipContent>
          </Tooltip>
          <ButtonGroupSeparator className="bg-border/70" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Rotate 90 degrees clockwise"
                  onClick={() => onRotate("clockwise")}
                />
              }
            >
              <RotateCwIcon />
            </TooltipTrigger>
            <TooltipContent>Rotate 90° clockwise</TooltipContent>
          </Tooltip>
          <ButtonGroupSeparator className="bg-border/70" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Mirror horizontally"
                  aria-pressed={flipX}
                  onClick={onFlipHorizontal}
                />
              }
            >
              <FlipHorizontal2Icon />
            </TooltipTrigger>
            <TooltipContent>Mirror horizontally</TooltipContent>
          </Tooltip>
          <ButtonGroupSeparator className="bg-border/70" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Mirror vertically"
                  aria-pressed={flipY}
                  onClick={onFlipVertical}
                />
              }
            >
              <FlipVertical2Icon />
            </TooltipTrigger>
            <TooltipContent>Mirror vertically</TooltipContent>
          </Tooltip>
        </ButtonGroup>
        <ButtonGroup className="overflow-hidden rounded-lg border border-border/70 bg-background/65 shadow-[0_1px_1px_rgb(0_0_0_/_0.04)]">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Undo"
                  disabled
                />
              }
            >
              <Undo2Icon />
            </TooltipTrigger>
            <TooltipContent>Undo · Coming soon</TooltipContent>
          </Tooltip>
          <ButtonGroupSeparator className="bg-border/70" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Redo"
                  disabled
                />
              }
            >
              <Redo2Icon />
            </TooltipTrigger>
            <TooltipContent>Redo · Coming soon</TooltipContent>
          </Tooltip>
        </ButtonGroup>
      </div>

      <div className="space-y-2">
        <span className="block text-xs font-medium text-muted-foreground">
          Aspect ratio
        </span>
        <Tabs
          value={String(aspect)}
          onValueChange={(value) => onAspectChange(Number(value))}
          variant="segment"
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5">
            {ASPECT_RATIOS.map((ratio) => (
              <TabsTrigger
                key={ratio.label}
                value={String(ratio.value)}
                className="px-1 py-2 text-xs"
              >
                {ratio.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Zoom</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>
        <Slider
          value={[zoom]}
          className="[&_[data-slot=slider-track]]:h-1.5"
          onValueChange={(v) => onZoomChange(Array.isArray(v) ? v[0] : v)}
          min={1}
          max={3}
          step={0.01}
        />
      </div>
    </section>
  );
}
