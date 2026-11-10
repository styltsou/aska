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
  removePexelsBrowserSelected: (scope: string, ids: readonly string[]) => void;
}

export function getPexelsBrowserScope(
  workspaceSlug: string,
  collectionSlug: string,
): string {
  return `${workspaceSlug}/${collectionSlug}`;
}

export function getLastPexelsQuery(scope: string): string {
  try {
    return localStorage.getItem(`pexels-query:${scope}`) ?? "";
  } catch {
    return "";
  }
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
  setPexelsBrowserQuery: (scope, query) => {
    try {
      if (query) localStorage.setItem(`pexels-query:${scope}`, query);
      else localStorage.removeItem(`pexels-query:${scope}`);
    } catch {}
    set((state) => {
      state.pexelsBrowserByScope[scope] ??= {
        open: false,
        query: "",
        selected: [],
      };
      state.pexelsBrowserByScope[scope].query = query;
    });
  },
  setPexelsBrowserSelected: (scope, selected) =>
    set((state) => {
      state.pexelsBrowserByScope[scope] ??= {
        open: false,
        query: "",
        selected: [],
      };
      state.pexelsBrowserByScope[scope].selected = selected;
    }),
  removePexelsBrowserSelected: (scope, ids) =>
    set((state) => {
      const browser = state.pexelsBrowserByScope[scope];
      if (browser) {
        browser.selected = browser.selected.filter(
          (photo) => !ids.includes(photo.id),
        );
      }
    }),
});
