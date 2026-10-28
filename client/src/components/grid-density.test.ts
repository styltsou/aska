import { describe, expect, it } from "vitest";
import { columnsForGrid, GRID_DENSITIES, GRID_GAP } from "./grid-density";

describe("grid density", () => {
  it("increases columns with the container while keeping large-screen cards bounded", () => {
    for (const density of ["spacious", "balanced", "compact"] as const) {
      const small = columnsForGrid(900, density);
      const large = columnsForGrid(1600, density);
      expect(large).toBeGreaterThan(small);
      const width = (1600 - GRID_GAP * (large - 1)) / large;
      expect(width).toBeLessThanOrEqual(GRID_DENSITIES[density].maxWidth);
    }
    expect(columnsForGrid(1600, "spacious")).toBeLessThan(
      columnsForGrid(1600, "compact"),
    );
  });
});
