import { create } from "zustand";
import { createAssetSlice, type AssetSlice } from "@/store/slices/asset-slice";

export type AppStore = AssetSlice;

export const useStore = create<AppStore>()((...a) => ({
  ...createAssetSlice(...a),
}));
