import type { StateCreator } from "zustand";
import { APP_STORE_STORAGE_KEY } from "@/store/storage";

export const DEFAULT_SIDEBAR_OPEN = true;

export interface SidebarSlice {
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
}

export interface TransientSidebarSlice {
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
}

export const createSidebarSlice: StateCreator<SidebarSlice> = (set) => ({
  open: readStoredOpen(),
  setOpen: (value) =>
    set((state) => ({
      open: typeof value === "function" ? value(state.open) : value,
    })),
});

export const createTransientSidebarSlice: StateCreator<
  TransientSidebarSlice
> = (set) => ({
  openMobile: false,
  setOpenMobile: (open) => set({ openMobile: open }),
});

// Lazy-read the persisted value during store creation so the first paint
// already reflects the collapsed/expanded state, avoiding a flash while the
// persist middleware rehydrates in a microtask.
function readStoredOpen(): boolean {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_OPEN;
  try {
    const raw = window.localStorage.getItem(APP_STORE_STORAGE_KEY);
    if (!raw) return DEFAULT_SIDEBAR_OPEN;
    const stored = JSON.parse(raw) as { state?: { open?: unknown } };
    return typeof stored.state?.open === "boolean"
      ? stored.state.open
      : DEFAULT_SIDEBAR_OPEN;
  } catch {
    return DEFAULT_SIDEBAR_OPEN;
  }
}
