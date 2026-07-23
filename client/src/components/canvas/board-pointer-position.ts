import type { BoardPosition } from "@/api/collection";

// Pointer movement is high-frequency. Keep it outside React/Zustand state so
// paste can read the latest location without re-rendering the canvas.
const positions = new Map<string, BoardPosition>();

export function setBoardPointerPosition(
  boardKey: string,
  position: BoardPosition,
) {
  positions.set(boardKey, position);
}

export function getBoardPointerPosition(boardKey: string) {
  return positions.get(boardKey);
}
