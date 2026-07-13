import { cn } from "@/lib/utils";

import { Slider } from "@/components/ui/slider";

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
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t bg-background px-3 py-2">
      <div className="flex items-center gap-1">
        <span className="mr-1.5 text-xs font-medium text-muted-foreground">
          Aspect:
        </span>
        {ASPECT_RATIOS.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => onAspectChange(r.value)}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              aspect === r.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Zoom:</span>
        <Slider
          value={[zoom]}
          onValueChange={(v) => onZoomChange(Array.isArray(v) ? v[0] : v)}
          min={1}
          max={3}
          step={0.01}
          className="w-24"
        />
      </div>
    </div>
  );
}
