import type {
  BoardPosition,
  CanvasArrowEndpoint,
  CanvasArrowObject,
  CanvasObject,
} from "@/api/collection";

type PositionedNode = {
  id: string;
  position: BoardPosition;
  measured?: { width?: number; height?: number };
  width?: number;
  height?: number;
};

export type ArrowSnapshot = {
  id: string;
  start: BoardPosition;
  end: BoardPosition;
  points: BoardPosition[];
};

function round(position: BoardPosition): BoardPosition {
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

function resolveEndpoint(
  endpoint: CanvasArrowEndpoint,
  nodes: ReadonlyMap<string, PositionedNode>,
): BoardPosition {
  const binding = endpoint.binding;
  const target = binding ? nodes.get(binding.targetId) : undefined;
  if (!target) return endpoint.position;
  const width = target.measured?.width ?? target.width;
  const height = target.measured?.height ?? target.height;
  if (!width || !height) return endpoint.position;
  return round({
    x: target.position.x + width * binding!.anchor.x,
    y: target.position.y + height * binding!.anchor.y,
  });
}

export function getArrowSnapshots(
  objects: readonly CanvasObject[],
  nodes: readonly PositionedNode[],
): ArrowSnapshot[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return objects.flatMap((object) =>
    object.type === "arrow"
      ? [
          {
            id: object.id,
            start: resolveEndpoint(object.start, byId),
            end: resolveEndpoint(object.end, byId),
            points: object.points,
          },
        ]
      : [],
  );
}

export function getInternalArrowIds(
  objects: readonly CanvasObject[],
  selectedIds: ReadonlySet<string>,
): string[] {
  return objects.flatMap((object) => {
    if (object.type !== "arrow" || selectedIds.has(object.id)) return [];
    const start = object.start.binding?.targetId;
    const end = object.end.binding?.targetId;
    return start && end && selectedIds.has(start) && selectedIds.has(end)
      ? [object.id]
      : [];
  });
}

export function translateArrowForSelection(
  arrow: CanvasArrowObject,
  snapshot: ArrowSnapshot,
  movingIds: ReadonlySet<string>,
  delta: BoardPosition,
): Pick<CanvasArrowObject, "start" | "end" | "points"> {
  const selected = movingIds.has(arrow.id);
  const startMoves = Boolean(
    arrow.start.binding && movingIds.has(arrow.start.binding.targetId),
  );
  const endMoves = Boolean(
    arrow.end.binding && movingIds.has(arrow.end.binding.targetId),
  );
  const movedStart = selected || startMoves;
  const movedEnd = selected || endMoves;
  const endpoint = (
    original: CanvasArrowEndpoint,
    position: BoardPosition,
    moves: boolean,
    keepBinding: boolean,
  ): CanvasArrowEndpoint => ({
    position: moves
      ? round({ x: position.x + delta.x, y: position.y + delta.y })
      : position,
    ...(keepBinding && original.binding ? { binding: original.binding } : {}),
  });
  const bendDelta = selected
    ? delta
    : startMoves && endMoves
      ? delta
      : { x: 0, y: 0 };
  return {
    start: endpoint(
      arrow.start,
      snapshot.start,
      movedStart,
      !selected || startMoves,
    ),
    end: endpoint(arrow.end, snapshot.end, movedEnd, !selected || endMoves),
    points: arrow.points.map((point) =>
      round({ x: point.x + bendDelta.x, y: point.y + bendDelta.y }),
    ),
  };
}

export function getTranslatedArrowUpdates(
  objects: readonly CanvasObject[],
  snapshots: readonly ArrowSnapshot[],
  movingIds: ReadonlySet<string>,
  delta: BoardPosition,
): Array<{
  id: string;
  start: CanvasArrowEndpoint;
  end: CanvasArrowEndpoint;
  points: BoardPosition[];
  rotation: number;
  routing: CanvasArrowObject["routing"];
}> {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return objects.flatMap((object) => {
    if (object.type !== "arrow") return [];
    const selected = movingIds.has(object.id);
    const startMoves = Boolean(
      object.start.binding && movingIds.has(object.start.binding.targetId),
    );
    const endMoves = Boolean(
      object.end.binding && movingIds.has(object.end.binding.targetId),
    );
    if (!selected && !startMoves && !endMoves) return [];
    const snapshot = byId.get(object.id);
    if (!snapshot) return [];
    return [
      {
        id: object.id,
        ...translateArrowForSelection(object, snapshot, movingIds, delta),
        rotation: object.rotation,
        routing: object.routing,
      },
    ];
  });
}

export function getLayoutArrowUpdates(
  objects: readonly CanvasObject[],
  snapshots: readonly ArrowSnapshot[],
  nodeDeltas: ReadonlyMap<string, BoardPosition>,
): Array<{
  id: string;
  start: CanvasArrowEndpoint;
  end: CanvasArrowEndpoint;
  points: BoardPosition[];
  rotation: number;
  routing: CanvasArrowObject["routing"];
}> {
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return objects.flatMap((object) => {
    if (object.type !== "arrow") return [];
    const startDelta = object.start.binding
      ? nodeDeltas.get(object.start.binding.targetId)
      : undefined;
    const endDelta = object.end.binding
      ? nodeDeltas.get(object.end.binding.targetId)
      : undefined;
    if (!startDelta && !endDelta) return [];
    const snapshot = byId.get(object.id);
    if (!snapshot) return [];
    const a = startDelta ?? { x: 0, y: 0 };
    const b = endDelta ?? { x: 0, y: 0 };
    const dx = snapshot.end.x - snapshot.start.x;
    const dy = snapshot.end.y - snapshot.start.y;
    const lengthSquared = dx * dx + dy * dy;
    return [
      {
        id: object.id,
        start: {
          ...object.start,
          position: round({
            x: snapshot.start.x + a.x,
            y: snapshot.start.y + a.y,
          }),
        },
        end: {
          ...object.end,
          position: round({
            x: snapshot.end.x + b.x,
            y: snapshot.end.y + b.y,
          }),
        },
        points: snapshot.points.map((point) => {
          const t =
            lengthSquared === 0
              ? 0.5
              : Math.max(
                  0,
                  Math.min(
                    1,
                    ((point.x - snapshot.start.x) * dx +
                      (point.y - snapshot.start.y) * dy) /
                      lengthSquared,
                  ),
                );
          return round({
            x: point.x + a.x * (1 - t) + b.x * t,
            y: point.y + a.y * (1 - t) + b.y * t,
          });
        }),
        rotation: object.rotation,
        routing: object.routing,
      },
    ];
  });
}
