import { useCallback, useState } from "react";

export type GridDensity = "spacious" | "balanced" | "compact";

export const GRID_DENSITIES: Record<
  GridDensity,
  { label: string; minWidth: number; maxWidth: number }
> = {
  spacious: { label: "Spacious", minWidth: 300, maxWidth: 600 },
  balanced: { label: "Balanced", minWidth: 230, maxWidth: 330 },
  compact: { label: "Compact", minWidth: 160, maxWidth: 210 },
};

export const GRID_GAP = 10;

export function getSavedGridDensity(): GridDensity {
  if (typeof window === "undefined") return "balanced";
  const saved = window.localStorage.getItem("aska:grid-density");
  return saved === "spacious" || saved === "compact" ? saved : "balanced";
}

export function useGridDensity() {
  const [density, setDensityState] = useState<GridDensity>(getSavedGridDensity);
  const setDensity = useCallback((next: GridDensity) => {
    setDensityState(next);
    window.localStorage.setItem("aska:grid-density", next);
  }, []);
  return { density, setDensity };
}

export function columnsForGrid(width: number, density: GridDensity): number {
  if (width <= 0) return 0;
  const { minWidth, maxWidth } = GRID_DENSITIES[density];
  const minimum = Math.max(
    1,
    Math.ceil((width + GRID_GAP) / (maxWidth + GRID_GAP)),
  );
  const maximum = Math.max(
    1,
    Math.floor((width + GRID_GAP) / (minWidth + GRID_GAP)),
  );
  const preferred = Math.round(
    (width + GRID_GAP) / ((minWidth + maxWidth) / 2 + GRID_GAP),
  );
  return Math.max(minimum, Math.min(maximum, preferred));
}
