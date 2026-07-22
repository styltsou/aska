import type { StateCreator } from "zustand";

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

export const createFilterBarSlice: StateCreator<FilterBarSlice> = (set) => ({
  filterBars: {},
  setFilterBarOpen: (scope, open) =>
    set((state) => ({
      filterBars: {
        ...state.filterBars,
        [scope]: { ...getFilterBarState(state, scope), open },
      },
    })),
  toggleFilterBar: (scope) =>
    set((state) => ({
      filterBars: {
        ...state.filterBars,
        [scope]: {
          ...getFilterBarState(state, scope),
          open: !getFilterBarState(state, scope).open,
        },
      },
    })),
  toggleColor: (scope, color) =>
    set((state) => {
      const filterBar = getFilterBarState(state, scope);

      return {
        filterBars: {
          ...state.filterBars,
          [scope]: {
            ...filterBar,
            selectedColors: filterBar.selectedColors.includes(color)
              ? filterBar.selectedColors.filter((current) => current !== color)
              : filterBar.selectedColors.length >= MAX_COLOR_FILTERS
                ? filterBar.selectedColors
                : [...filterBar.selectedColors, color],
          },
        },
      };
    }),
  clearColors: (scope) =>
    set((state) => ({
      filterBars: {
        ...state.filterBars,
        [scope]: { ...getFilterBarState(state, scope), selectedColors: [] },
      },
    })),
  toggleAssetType: (scope, type) =>
    set((state) => {
      const filterBar = getFilterBarState(state, scope);

      return {
        filterBars: {
          ...state.filterBars,
          [scope]: {
            ...filterBar,
            selectedAssetTypes: filterBar.selectedAssetTypes.includes(type)
              ? filterBar.selectedAssetTypes.filter(
                  (current) => current !== type,
                )
              : [...filterBar.selectedAssetTypes, type],
          },
        },
      };
    }),
  clearAssetTypes: (scope) =>
    set((state) => ({
      filterBars: {
        ...state.filterBars,
        [scope]: { ...getFilterBarState(state, scope), selectedAssetTypes: [] },
      },
    })),
  setFilterType: (scope, filterType) =>
    set((state) => ({
      filterBars: {
        ...state.filterBars,
        [scope]: { ...getFilterBarState(state, scope), filterType },
      },
    })),
});

function getFilterBarState(
  state: Pick<FilterBarSlice, "filterBars">,
  scope: string,
): FilterBarState {
  return { ...DEFAULT_FILTER_BAR_STATE, ...state.filterBars[scope] };
}
