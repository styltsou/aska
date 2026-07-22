import type { StateCreator } from "zustand";

export type SelectionState = {
  scopeKey: string | null;
  nodeIds: string[];
};

export interface SelectionSlice {
  selection: SelectionState;
  activateSelectionScope: (scopeKey: string) => void;
  replaceSelection: (scopeKey: string, nodeIds: Iterable<string>) => void;
  toggleSelectedNode: (scopeKey: string, nodeId: string) => void;
  clearSelection: (scopeKey?: string) => void;
}

function uniqueIds(nodeIds: Iterable<string>): string[] {
  return [...new Set(nodeIds)];
}

function selectionsEqual(a: SelectionState, b: SelectionState): boolean {
  return (
    a.scopeKey === b.scopeKey &&
    a.nodeIds.length === b.nodeIds.length &&
    a.nodeIds.every((nodeId, index) => nodeId === b.nodeIds[index])
  );
}

export const createSelectionSlice: StateCreator<SelectionSlice> = (set) => ({
  selection: { scopeKey: null, nodeIds: [] },
  activateSelectionScope: (scopeKey) =>
    set((state) => {
      const selection =
        state.selection.scopeKey === scopeKey
          ? state.selection
          : { scopeKey, nodeIds: [] };
      return selectionsEqual(state.selection, selection)
        ? state
        : { selection };
    }),
  replaceSelection: (scopeKey, nodeIds) =>
    set((state) => {
      const selection = { scopeKey, nodeIds: uniqueIds(nodeIds) };
      return selectionsEqual(state.selection, selection)
        ? state
        : { selection };
    }),
  toggleSelectedNode: (scopeKey, nodeId) =>
    set((state) => {
      const current =
        state.selection.scopeKey === scopeKey ? state.selection.nodeIds : [];
      const selection = {
        scopeKey,
        nodeIds: current.includes(nodeId)
          ? current.filter((id) => id !== nodeId)
          : [...current, nodeId],
      };
      return { selection };
    }),
  clearSelection: (scopeKey) =>
    set((state) => {
      if (scopeKey && state.selection.scopeKey !== scopeKey) return state;
      if (state.selection.nodeIds.length === 0) return state;
      return { selection: { ...state.selection, nodeIds: [] } };
    }),
});
