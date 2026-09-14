import { createContext, useContext, useRef } from "react";
import type { ReactNode, RefObject } from "react";

export type CanvasActionsHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  fitView: () => void;
};

const CanvasActionsContext =
  createContext<RefObject<CanvasActionsHandle | null> | null>(null);

export function CanvasActionsProvider({ children }: { children: ReactNode }) {
  const canvasActionsRef = useRef<CanvasActionsHandle | null>(null);

  return (
    <CanvasActionsContext.Provider value={canvasActionsRef}>
      {children}
    </CanvasActionsContext.Provider>
  );
}

export function useCanvasActions() {
  const canvasActionsRef = useContext(CanvasActionsContext);
  if (canvasActionsRef === null) {
    throw new Error(
      "useCanvasActions must be used within a CanvasActionsProvider",
    );
  }
  return canvasActionsRef;
}
