import type { StateCreator } from "zustand";

export interface PexelsBrowserSlice {
  pexelsBrowserOpen: boolean;
  setPexelsBrowserOpen: (open: boolean) => void;
}

export const createPexelsBrowserSlice: StateCreator<PexelsBrowserSlice> = (
  set,
) => ({
  pexelsBrowserOpen: false,
  setPexelsBrowserOpen: (open) => set({ pexelsBrowserOpen: open }),
});
