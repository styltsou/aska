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

  it("lets spacious cards resize across desktop widths before adding a column", () => {
    expect(columnsForGrid(1600, "spacious")).toBe(4);
    expect(columnsForGrid(2200, "spacious")).toBe(5);
    expect(columnsForGrid(2500, "spacious")).toBe(5);
    expect(columnsForGrid(2800, "spacious")).toBe(6);
  });

  it("shows five, eight, and twelve columns across a wide desktop grid", () => {
    expect(columnsForGrid(2400, "spacious")).toBe(5);
    expect(columnsForGrid(2400, "balanced")).toBe(8);
    expect(columnsForGrid(2400, "compact")).toBe(12);
  });

  it.each([
    [900, 2, 3, 5],
    [1100, 2, 4, 6],
    [1300, 3, 5, 7],
    [1600, 4, 6, 8],
  ])(
    "keeps the three density roles distinct at %ipx of grid space",
    (width, spacious, balanced, compact) => {
      expect(columnsForGrid(width, "spacious")).toBe(spacious);
      expect(columnsForGrid(width, "balanced")).toBe(balanced);
      expect(columnsForGrid(width, "compact")).toBe(compact);
    },
  );
});
