import type { BoardPosition } from "@/api/collection";

// Pointer movement is high-frequency. Keep it outside React/Zustand state so
// paste can read the latest location without re-rendering the canvas.
const positions = new Map<string, BoardPosition>();
const flowPositionConverters = new Map<
  string,
  (clientPosition: BoardPosition) => BoardPosition
>();

export function setBoardPointerPosition(
  boardKey: string,
  position: BoardPosition,
) {
  positions.set(boardKey, position);
}

export function getBoardPointerPosition(boardKey: string) {
  return positions.get(boardKey);
}

export function setBoardFlowPositionConverter(
  boardKey: string,
  convert: (clientPosition: BoardPosition) => BoardPosition,
) {
  flowPositionConverters.set(boardKey, convert);

  return () => {
    if (flowPositionConverters.get(boardKey) === convert) {
      flowPositionConverters.delete(boardKey);
    }
  };
}

export function getBoardFlowPosition(
  boardKey: string,
  clientPosition: BoardPosition,
) {
  return flowPositionConverters.get(boardKey)?.(clientPosition);
}
