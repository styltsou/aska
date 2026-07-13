import type { StateCreator } from "zustand";

export type FilterColor = string;

export interface FilterBarSlice {
  filterBarOpen: boolean;
  setFilterBarOpen: (open: boolean) => void;
  toggleFilterBar: () => void;
  selectedColors: FilterColor[];
  toggleColor: (color: FilterColor) => void;
  clearColors: () => void;
  filterType: string;
  setFilterType: (type: string) => void;
}

export const createFilterBarSlice: StateCreator<FilterBarSlice> = (set) => ({
  filterBarOpen: false,
  setFilterBarOpen: (open) => set({ filterBarOpen: open }),
  toggleFilterBar: () =>
    set((state) => ({ filterBarOpen: !state.filterBarOpen })),
  selectedColors: [],
  toggleColor: (color) =>
    set((state) => ({
      selectedColors: state.selectedColors.includes(color)
        ? state.selectedColors.filter((c) => c !== color)
        : [...state.selectedColors, color],
    })),
  clearColors: () => set({ selectedColors: [] }),
  filterType: "Color",
  setFilterType: (type) => set({ filterType: type }),
});
