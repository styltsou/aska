import type {
  BoardInsertionPlacement,
  BoardPosition,
  BoardVisibleBounds,
} from "@/api/collection";

// Pointer movement is high-frequency. Keep it outside React/Zustand state so
// paste can read the latest location without re-rendering the canvas.
const positions = new Map<string, BoardPosition>();
const flowPositionConverters = new Map<
  string,
  (clientPosition: BoardPosition) => BoardPosition
>();
const viewportZoomReaders = new Map<string, () => number>();

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

export function setBoardViewportZoomReader(
  boardKey: string,
  readZoom: () => number,
) {
  viewportZoomReaders.set(boardKey, readZoom);

  return () => {
    if (viewportZoomReaders.get(boardKey) === readZoom) {
      viewportZoomReaders.delete(boardKey);
    }
  };
}

export function getBoardViewportZoom(boardKey: string) {
  return viewportZoomReaders.get(boardKey)?.() ?? 1;
}

export function getBoardDropPlacement(
  boardKey: string,
  clientPosition: BoardPosition,
  visibleBounds: BoardVisibleBounds | undefined,
): BoardInsertionPlacement {
  const position = getBoardFlowPosition(boardKey, clientPosition);
  if (position) {
    return {
      position: { x: Math.round(position.x), y: Math.round(position.y) },
    };
  }

  return visibleBounds ? { visibleBounds } : {};
}

export function getBoardPastePlacement(
  boardKey: string,
  visibleBounds: BoardVisibleBounds | undefined,
): BoardInsertionPlacement | undefined {
  const position = getBoardPointerPosition(boardKey);
  return position || visibleBounds ? { position, visibleBounds } : undefined;
}
