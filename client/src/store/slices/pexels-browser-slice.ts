import type { StateCreator } from "zustand";
import type { PexelsPhoto } from "@/api/pexels";

export interface PexelsBrowserScopeState {
  query: string;
  selected: PexelsPhoto[];
}

export interface PexelsBrowserScopeSlice {
  pexelsBrowserOpen: boolean;
  setPexelsBrowserOpen: (open: boolean) => void;
  pexelsBrowserByScope: Record<string, PexelsBrowserScopeState | undefined>;
  setPexelsBrowserQuery: (scope: string, query: string) => void;
  setPexelsBrowserSelected: (scope: string, selected: PexelsPhoto[]) => void;
}

export const createPexelsBrowserScopeSlice: StateCreator<
  PexelsBrowserScopeSlice
> = (set) => ({
  pexelsBrowserOpen: false,
  setPexelsBrowserOpen: (open) => set({ pexelsBrowserOpen: open }),
  pexelsBrowserByScope: {},
  setPexelsBrowserQuery: (scope, query) =>
    set((state) => {
      const current = state.pexelsBrowserByScope[scope];
      return {
        pexelsBrowserByScope: {
          ...state.pexelsBrowserByScope,
          [scope]: { query, selected: current?.selected ?? [] },
        },
      };
    }),
  setPexelsBrowserSelected: (scope, selected) =>
    set((state) => {
      const current = state.pexelsBrowserByScope[scope];
      return {
        pexelsBrowserByScope: {
          ...state.pexelsBrowserByScope,
          [scope]: { query: current?.query ?? "", selected },
        },
      };
    }),
});
