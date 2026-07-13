import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAssetSlice, type AssetSlice } from "@/store/slices/asset-slice";
import {
  createFilterBarSlice,
  type FilterBarSlice,
} from "@/store/slices/filter-bar-slice";

export type AppStore = AssetSlice & FilterBarSlice;
type PersistedAppStore = Pick<
  FilterBarSlice,
  "filterBarOpen" | "selectedColors" | "filterType"
>;

export const useStore = create<AppStore>()(
  persist<AppStore, [], [], PersistedAppStore>(
    (...a) => ({
      ...createAssetSlice(...a),
      ...createFilterBarSlice(...a),
    }),
    {
      name: "app-store",
      storage: {
        getItem: (name) => {
          const raw = sessionStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
      partialize: (state) => ({
        filterBarOpen: state.filterBarOpen,
        selectedColors: state.selectedColors,
        filterType: state.filterType,
      }),
    },
  ),
);
