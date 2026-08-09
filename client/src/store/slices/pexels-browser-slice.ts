import type { StateCreator } from "zustand";
import type { SessionStore } from "@/store";
import type { PexelsPhoto } from "@/api/pexels";

export interface PexelsBrowserScopeState {
  open: boolean;
  query: string;
  selected: PexelsPhoto[];
}

export interface PexelsBrowserScopeSlice {
  pexelsBrowserByScope: Record<string, PexelsBrowserScopeState | undefined>;
  setPexelsBrowserOpen: (scope: string, open: boolean) => void;
  setPexelsBrowserQuery: (scope: string, query: string) => void;
  setPexelsBrowserSelected: (scope: string, selected: PexelsPhoto[]) => void;
}

export function getPexelsBrowserScope(
  workspaceSlug: string,
  collectionSlug: string,
): string {
  return `${workspaceSlug}/${collectionSlug}`;
}

export const createPexelsBrowserScopeSlice: StateCreator<
  SessionStore,
  [["zustand/immer", never]],
  [],
  PexelsBrowserScopeSlice
> = (set) => ({
  pexelsBrowserByScope: {},
  setPexelsBrowserOpen: (scope, open) =>
    set((state) => {
      state.pexelsBrowserByScope[scope] ??= {
        open: false,
        query: "",
        selected: [],
      };
      state.pexelsBrowserByScope[scope].open = open;
    }),
  setPexelsBrowserQuery: (scope, query) =>
    set((state) => {
      state.pexelsBrowserByScope[scope] ??= {
        open: false,
        query: "",
        selected: [],
      };
      state.pexelsBrowserByScope[scope].query = query;
    }),
  setPexelsBrowserSelected: (scope, selected) =>
    set((state) => {
      state.pexelsBrowserByScope[scope] ??= {
        open: false,
        query: "",
        selected: [],
      };
      state.pexelsBrowserByScope[scope].selected = selected;
    }),
});
