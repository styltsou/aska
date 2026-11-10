import type { StateCreator } from "zustand";

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

export const createCollectionViewSlice: StateCreator<CollectionViewSlice> = (
  set,
) => ({
  collectionViews: {},
  setCollectionView: (scope, view) =>
    set((state) => ({
      collectionViews: { ...state.collectionViews, [scope]: view },
    })),
});
