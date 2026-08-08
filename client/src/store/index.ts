import { create } from "zustand";
import { persist } from "zustand/middleware";
import { APP_STORE_STORAGE_KEY } from "@/store/storage";
import {
  createSidebarSlice,
  createTransientSidebarSlice,
  type SidebarSlice,
  type TransientSidebarSlice,
} from "@/store/slices/sidebar-slice";
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
import {
  createScratchpadSlice,
  type ScratchpadSlice,
} from "@/store/slices/scratchpad-slice";

export type PersistedStore = FilterBarSlice &
  PersistedBoardSlice &
  SidebarSlice;
export type TransientStore = AssetSlice &
  SelectionSlice &
  TransientBoardSlice &
  ScratchpadSlice &
  TransientSidebarSlice;

export const useTransientStore = create<TransientStore>()((...a) => ({
  ...createAssetSlice(...a),
  ...createSelectionSlice(...a),
  ...createTransientBoardSlice(...a),
  ...createScratchpadSlice(...a),
  ...createTransientSidebarSlice(...a),
}));

export const usePersistedStore = create<PersistedStore>()(
  persist<PersistedStore>(
    (...a) => ({
      ...createFilterBarSlice(...a),
      ...createPersistedBoardSlice(...a),
      ...createSidebarSlice(...a),
    }),
    {
      name: APP_STORE_STORAGE_KEY,
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
