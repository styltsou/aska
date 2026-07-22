import type { StateCreator } from "zustand";
import type { Viewport, XYPosition } from "@xyflow/react";
import type { BoardVisibleBounds } from "@/api/collection";

export interface PersistedBoardSlice {
  boardViewports: Record<string, Viewport>;
  boardLocks: Record<string, boolean | undefined>;
  setBoardViewport: (boardKey: string, viewport: Viewport) => void;
  setBoardLock: (boardKey: string, locked: boolean) => void;
}

export const createPersistedBoardSlice: StateCreator<PersistedBoardSlice> = (
  set,
) => ({
  boardViewports: {},
  boardLocks: {},
  setBoardViewport: (boardKey, viewport) =>
    set((state) => ({
      boardViewports: { ...state.boardViewports, [boardKey]: viewport },
    })),
  setBoardLock: (boardKey, locked) =>
    set((state) => ({
      boardLocks: { ...state.boardLocks, [boardKey]: locked },
    })),
});

export interface TransientBoardSlice {
  boardVisibleBounds: Record<string, BoardVisibleBounds | undefined>;
  insertionPositions: Record<string, XYPosition | undefined>;
  setBoardVisibleBounds: (
    boardKey: string,
    bounds?: BoardVisibleBounds,
  ) => void;
  setInsertionPosition: (boardKey: string, position?: XYPosition) => void;
}

export const createTransientBoardSlice: StateCreator<TransientBoardSlice> = (
  set,
) => ({
  boardVisibleBounds: {},
  insertionPositions: {},
  setBoardVisibleBounds: (boardKey, bounds) =>
    set((state) => ({
      boardVisibleBounds: { ...state.boardVisibleBounds, [boardKey]: bounds },
    })),
  setInsertionPosition: (boardKey, position) =>
    set((state) => ({
      insertionPositions: {
        ...state.insertionPositions,
        [boardKey]: position,
      },
    })),
});
