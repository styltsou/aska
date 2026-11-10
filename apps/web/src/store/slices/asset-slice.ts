import type { StateCreator } from "zustand";

export type DragState =
  | { status: "idle" }
  | { status: "dragging"; assetId: string; sourceFolderId: string | null }
  | {
      status: "over";
      assetId: string;
      sourceFolderId: string | null;
      targetFolderId: string;
    };

export interface AssetSlice {
  drag: DragState;
  setDrag: (drag: DragState) => void;
}

export const createAssetSlice: StateCreator<AssetSlice> = (set) => ({
  drag: { status: "idle" },
  setDrag: (drag) => set({ drag }),
});
