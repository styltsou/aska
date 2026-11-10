import type { StateCreator } from "zustand";

export interface ScratchpadSlice {
  scratchpadOpen: boolean;
  openScratchpad: () => void;
  closeScratchpad: () => void;
}

export const createScratchpadSlice: StateCreator<ScratchpadSlice> = (
  set,
  get,
) => ({
  scratchpadOpen: false,
  openScratchpad: () => {
    if (get().scratchpadOpen) return;
    set({ scratchpadOpen: true });
  },
  closeScratchpad: () => set({ scratchpadOpen: false }),
});
