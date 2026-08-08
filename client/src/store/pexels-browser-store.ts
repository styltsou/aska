import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createPexelsBrowserScopeSlice,
  type PexelsBrowserScopeSlice,
} from "@/store/slices/pexels-browser-slice";

export const usePexelsBrowserStore = create<PexelsBrowserScopeSlice>()(
  persist<PexelsBrowserScopeSlice>(
    (...a) => ({
      ...createPexelsBrowserScopeSlice(...a),
    }),
    {
      name: "pexels-browser-store",
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
