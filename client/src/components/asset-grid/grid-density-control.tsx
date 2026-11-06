import {
  GRID_DENSITIES,
  useGridDensity,
  type GridDensity,
} from "@/components/asset-grid/grid-density";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

export function GridDensityControl() {
  const { density, setDensity } = useGridDensity();

  return (
    <Tabs
      value={density}
      onValueChange={(value) => setDensity(value as GridDensity)}
      variant="segment-contrast"
      size="sm"
      className="pointer-events-auto h-fit"
    >
      <TabsList
        data-grid-control
        aria-label="Grid size"
        className={cn("bg-background/50", GLASS_FRAME_CLASS, "ring-0")}
      >
        {(
          Object.entries(GRID_DENSITIES) as [
            GridDensity,
            (typeof GRID_DENSITIES)[GridDensity],
          ][]
        ).map(([option, preset]) => (
          <TabsTrigger key={option} value={option}>
            {preset.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
