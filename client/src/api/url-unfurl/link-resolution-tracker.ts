import { create } from "zustand";

type LinkResolutionTracker = {
  pendingByWorkspace: Record<string, readonly string[]>;
  track: (workspaceSlug: string, assetId: string) => void;
  untrack: (workspaceSlug: string, assetId: string) => void;
};

/** Tab-local links whose async unfurl result this browser should follow. */
export const useLinkResolutionTracker = create<LinkResolutionTracker>(
  (set) => ({
    pendingByWorkspace: {},
    track: (workspaceSlug, assetId) =>
      set((state) => {
        const pending = state.pendingByWorkspace[workspaceSlug] ?? [];
        if (pending.includes(assetId)) return state;
        return {
          pendingByWorkspace: {
            ...state.pendingByWorkspace,
            [workspaceSlug]: [...pending, assetId],
          },
        };
      }),
    untrack: (workspaceSlug, assetId) =>
      set((state) => {
        const pending = state.pendingByWorkspace[workspaceSlug];
        if (!pending?.includes(assetId)) return state;
        const next = pending.filter((id) => id !== assetId);
        const pendingByWorkspace = { ...state.pendingByWorkspace };
        if (next.length === 0) delete pendingByWorkspace[workspaceSlug];
        else pendingByWorkspace[workspaceSlug] = next;
        return { pendingByWorkspace };
      }),
  }),
);
