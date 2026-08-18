import type { StateCreator } from "zustand";

import type { SessionStore } from "@/store";
import type { BoardView } from "@/store/slices/board-slice";

export interface CollectionViewSlice {
  collectionViews: Record<string, BoardView | undefined>;
  setCollectionView: (scope: string, view: BoardView) => void;
}

export function getCollectionViewScope(
  workspaceSlug: string,
  collectionSlug: string,
): string {
  return `${workspaceSlug}:${collectionSlug}`;
}

export const createCollectionViewSlice: StateCreator<
  SessionStore,
  [["zustand/immer", never]],
  [],
  CollectionViewSlice
> = (set) => ({
  collectionViews: {},
  setCollectionView: (scope, view) =>
    set((state) => {
      state.collectionViews[scope] = view;
    }),
});
