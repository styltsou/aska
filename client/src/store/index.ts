import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  APP_STORE_STORAGE_KEY,
  SESSION_STORE_STORAGE_KEY,
} from "@/store/storage";
import {
  createFilterBarSlice,
  type FilterBarSlice,
} from "@/store/slices/filter-bar-slice";
import {
  createPexelsBrowserScopeSlice,
  getPexelsBrowserScope,
  type PexelsBrowserScopeSlice,
} from "@/store/slices/pexels-browser-slice";
import {
  createCollectionViewSlice,
  getCollectionViewScope,
  type CollectionViewSlice,
} from "@/store/slices/collection-view-slice";
import {
  createSidebarSlice,
  createTransientSidebarSlice,
  type SidebarSlice,
  type TransientSidebarSlice,
} from "@/store/slices/sidebar-slice";
import { createAssetSlice, type AssetSlice } from "@/store/slices/asset-slice";
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

export { getCollectionViewScope, getPexelsBrowserScope };

// True cross-session state, persisted to localStorage.
export type PersistedStore = PersistedBoardSlice & SidebarSlice;
export const usePersistedStore = create<PersistedStore>()(
  persist<PersistedStore>(
    (...a) => ({
      ...createPersistedBoardSlice(...a),
      ...createSidebarSlice(...a),
    }),
    {
      name: APP_STORE_STORAGE_KEY,
    },
  ),
);

// Tab-scoped state, persisted to sessionStorage.
export type SessionStore = CollectionViewSlice &
  FilterBarSlice &
  PexelsBrowserScopeSlice;
export const useSessionStore = create<SessionStore>()(
  persist(
    immer((...a) => ({
      ...createCollectionViewSlice(...a),
      ...createFilterBarSlice(...a),
      ...createPexelsBrowserScopeSlice(...a),
    })),
    {
      name: SESSION_STORE_STORAGE_KEY,
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
    },
  ),
);

// In-memory only, never persisted.
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
