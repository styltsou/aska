import type { StateCreator } from "zustand";
import type { SessionStore } from "@/store";

export type FilterColor = string;
export const FILTER_TYPES = ["Color", "Tags", "Type"] as const;
export type FilterType = (typeof FILTER_TYPES)[number];
export type AssetFilterType = "image" | "note" | "folder";
export const MAX_COLOR_FILTERS = 5;

export type FilterBarState = {
  open: boolean;
  selectedColors: FilterColor[];
  selectedTags: string[];
  selectedAssetTypes: AssetFilterType[];
  filterType: FilterType;
};

export interface FilterBarSlice {
  filterBars: Record<string, FilterBarState | undefined>;
  setFilterBarOpen: (scope: string, open: boolean) => void;
  toggleFilterBar: (scope: string) => void;
  toggleColor: (scope: string, color: FilterColor) => void;
  clearColors: (scope: string) => void;
  toggleAssetType: (scope: string, type: AssetFilterType) => void;
  clearAssetTypes: (scope: string) => void;
  setFilterType: (scope: string, type: FilterType) => void;
}

export const DEFAULT_FILTER_BAR_STATE: FilterBarState = {
  open: false,
  selectedColors: [],
  selectedTags: [],
  selectedAssetTypes: [],
  filterType: "Color",
};

function createFilterBarState(): FilterBarState {
  return {
    open: false,
    selectedColors: [],
    selectedTags: [],
    selectedAssetTypes: [],
    filterType: "Color",
  };
}

export const createFilterBarSlice: StateCreator<
  SessionStore,
  [["zustand/immer", never]],
  [],
  FilterBarSlice
> = (set) => ({
  filterBars: {},
  setFilterBarOpen: (scope, open) =>
    set((state) => {
      state.filterBars[scope] ??= createFilterBarState();
      state.filterBars[scope].open = open;
    }),
  toggleFilterBar: (scope) =>
    set((state) => {
      state.filterBars[scope] ??= createFilterBarState();
      state.filterBars[scope].open = !state.filterBars[scope].open;
    }),
  toggleColor: (scope, color) =>
    set((state) => {
      const filterBar = (state.filterBars[scope] ??= createFilterBarState());
      if (filterBar.selectedColors.includes(color)) {
        filterBar.selectedColors = filterBar.selectedColors.filter(
          (current) => current !== color,
        );
        return;
      }
      if (filterBar.selectedColors.length < MAX_COLOR_FILTERS) {
        filterBar.selectedColors.push(color);
      }
    }),
  clearColors: (scope) =>
    set((state) => {
      state.filterBars[scope] ??= createFilterBarState();
      state.filterBars[scope].selectedColors = [];
    }),
  toggleAssetType: (scope, type) =>
    set((state) => {
      const filterBar = (state.filterBars[scope] ??= createFilterBarState());
      if (filterBar.selectedAssetTypes.includes(type)) {
        filterBar.selectedAssetTypes = filterBar.selectedAssetTypes.filter(
          (current) => current !== type,
        );
        return;
      }
      filterBar.selectedAssetTypes.push(type);
    }),
  clearAssetTypes: (scope) =>
    set((state) => {
      state.filterBars[scope] ??= createFilterBarState();
      state.filterBars[scope].selectedAssetTypes = [];
    }),
  setFilterType: (scope, filterType) =>
    set((state) => {
      state.filterBars[scope] ??= createFilterBarState();
      state.filterBars[scope].filterType = filterType;
    }),
});
