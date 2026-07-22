import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createAssetSlice, type AssetSlice } from "@/store/slices/asset-slice";
import {
  createFilterBarSlice,
  type FilterBarSlice,
} from "@/store/slices/filter-bar-slice";
import {
  createPersistedBoardSlice,
  createTransientBoardSlice,
  type PersistedBoardSlice,
  type TransientBoardSlice,
} from "@/store/slices/board-slice";
import {
  createSelectionSlice,
  type SelectionSlice,
} from "@/store/slices/selection-slice";

export type PersistedStore = FilterBarSlice & PersistedBoardSlice;
export type TransientStore = AssetSlice & SelectionSlice & TransientBoardSlice;

export const useTransientStore = create<TransientStore>()((...a) => ({
  ...createAssetSlice(...a),
  ...createSelectionSlice(...a),
  ...createTransientBoardSlice(...a),
}));

export const usePersistedStore = create<PersistedStore>()(
  persist<PersistedStore>(
    (...a) => ({
      ...createFilterBarSlice(...a),
      ...createPersistedBoardSlice(...a),
    }),
    {
      name: "app-store",
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    },
  ),
);
