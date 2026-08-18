export type CanvasBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type BatchPlacementCompleted = {
  boardKey: string;
  nodeIds: string[];
  bounds: CanvasBounds;
};

type Listener = (placement: BatchPlacementCompleted) => void;

const listeners = new Set<Listener>();

/** A one-shot local UI notification with intentionally no replay or storage. */
export function emitBatchPlacementCompleted(
  placement: BatchPlacementCompleted,
) {
  for (const listener of listeners) listener(placement);
}

export function onBatchPlacementCompleted(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
