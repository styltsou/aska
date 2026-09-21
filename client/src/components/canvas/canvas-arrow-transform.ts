import type { BoardPosition } from "@/api/collection";

const FRAME_EPSILON = 0.001;

export type ArrowResizeHandle =
  | "north-west"
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west";

export type ArrowTransformFrame = {
  axisX: BoardPosition;
  axisY: BoardPosition;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  center: BoardPosition;
  width: number;
  height: number;
  angle: number;
};

type FrameBounds = Pick<ArrowTransformFrame, "minX" | "maxX" | "minY" | "maxY">;

const HANDLE_DIRECTIONS: Record<
  ArrowResizeHandle,
  { x: -1 | 0 | 1; y: -1 | 0 | 1 }
> = {
  "north-west": { x: -1, y: -1 },
  north: { x: 0, y: -1 },
  "north-east": { x: 1, y: -1 },
  east: { x: 1, y: 0 },
  "south-east": { x: 1, y: 1 },
  south: { x: 0, y: 1 },
  "south-west": { x: -1, y: 1 },
  west: { x: -1, y: 0 },
};

export const ARROW_RESIZE_HANDLES = Object.keys(
  HANDLE_DIRECTIONS,
) as ArrowResizeHandle[];

export const ARROW_CORNER_RESIZE_HANDLES = [
  "north-west",
  "north-east",
  "south-east",
  "south-west",
] as const satisfies readonly ArrowResizeHandle[];

export function arrowResizeCursor(
  handle: ArrowResizeHandle,
  frameAngle: number,
) {
  if (handle === "north" || handle === "south") return "cursor-ns-resize";
  if (handle === "east" || handle === "west") return "cursor-ew-resize";

  const diagonalAngle =
    frameAngle +
    (handle === "north-west" || handle === "south-east"
      ? Math.PI / 4
      : -Math.PI / 4);
  return closestDiagonalResizeCursor(diagonalAngle);
}

function closestDiagonalResizeCursor(angle: number) {
  const normalized = ((angle % Math.PI) + Math.PI) % Math.PI;
  return Math.abs(normalized - Math.PI / 4) <=
    Math.abs(normalized - (3 * Math.PI) / 4)
    ? "cursor-nwse-resize"
    : "cursor-nesw-resize";
}

export function makeArrowTransformFrame(
  points: readonly BoardPosition[],
  rotation = 0,
): ArrowTransformFrame {
  const safePoints = points.length > 0 ? points : [{ x: 0, y: 0 }];
  const angle = normalizeArrowRotation(rotation);
  const axisX = { x: Math.cos(angle), y: Math.sin(angle) };
  const axisY = { x: -axisX.y, y: axisX.x };
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of safePoints) {
    const projected = projectPoint(point, axisX, axisY);
    minX = Math.min(minX, projected.x);
    maxX = Math.max(maxX, projected.x);
    minY = Math.min(minY, projected.y);
    maxY = Math.max(maxY, projected.y);
  }

  const center = unprojectPoint(
    { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    axisX,
    axisY,
  );
  return {
    axisX,
    axisY,
    minX,
    maxX,
    minY,
    maxY,
    center,
    width: maxX - minX,
    height: maxY - minY,
    angle,
  };
}

export function paddedArrowFrameBounds(
  frame: ArrowTransformFrame,
  padding: number,
  minimumHalfThickness = padding,
): FrameBounds {
  const centerY = (frame.minY + frame.maxY) / 2;
  const halfHeight = Math.max(frame.height / 2 + padding, minimumHalfThickness);
  return {
    minX: frame.minX - padding,
    maxX: frame.maxX + padding,
    minY: centerY - halfHeight,
    maxY: centerY + halfHeight,
  };
}

export function arrowFrameCorners(
  frame: ArrowTransformFrame,
  bounds: FrameBounds,
): BoardPosition[] {
  return [
    frameLocalToWorld(frame, bounds.minX, bounds.minY),
    frameLocalToWorld(frame, bounds.maxX, bounds.minY),
    frameLocalToWorld(frame, bounds.maxX, bounds.maxY),
    frameLocalToWorld(frame, bounds.minX, bounds.maxY),
  ];
}

export function arrowFrameHandlePositions(
  frame: ArrowTransformFrame,
  bounds: FrameBounds,
): Record<ArrowResizeHandle, BoardPosition> {
  const middleX = (bounds.minX + bounds.maxX) / 2;
  const middleY = (bounds.minY + bounds.maxY) / 2;
  return {
    "north-west": frameLocalToWorld(frame, bounds.minX, bounds.minY),
    north: frameLocalToWorld(frame, middleX, bounds.minY),
    "north-east": frameLocalToWorld(frame, bounds.maxX, bounds.minY),
    east: frameLocalToWorld(frame, bounds.maxX, middleY),
    "south-east": frameLocalToWorld(frame, bounds.maxX, bounds.maxY),
    south: frameLocalToWorld(frame, middleX, bounds.maxY),
    "south-west": frameLocalToWorld(frame, bounds.minX, bounds.maxY),
    west: frameLocalToWorld(frame, bounds.minX, middleY),
  };
}

export function arrowFrameResizeHandlePositions(
  frame: ArrowTransformFrame,
  bounds: FrameBounds,
  distance: number,
): Record<ArrowResizeHandle, BoardPosition> {
  const positions = arrowFrameHandlePositions(frame, bounds);
  return Object.fromEntries(
    ARROW_RESIZE_HANDLES.map((handle) => {
      const direction = HANDLE_DIRECTIONS[handle];
      const length = Math.hypot(direction.x, direction.y);
      const local = {
        x: (direction.x / length) * distance,
        y: (direction.y / length) * distance,
      };
      return [
        handle,
        {
          x:
            positions[handle].x +
            frame.axisX.x * local.x +
            frame.axisY.x * local.y,
          y:
            positions[handle].y +
            frame.axisX.y * local.x +
            frame.axisY.y * local.y,
        },
      ];
    }),
  ) as Record<ArrowResizeHandle, BoardPosition>;
}

export function arrowRotationHandlePosition(
  frame: ArrowTransformFrame,
  bounds: FrameBounds,
  distance: number,
): { connector: BoardPosition; handle: BoardPosition } {
  const middleX = (bounds.minX + bounds.maxX) / 2;
  return {
    connector: frameLocalToWorld(frame, middleX, bounds.minY),
    handle: frameLocalToWorld(frame, middleX, bounds.minY - distance),
  };
}

export function arrowFrameScreenAnchors(
  corners: readonly BoardPosition[],
  verticalOffset: number,
) {
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  return {
    toolbar: { x: (minX + maxX) / 2, y: minY - verticalOffset },
    hint: { x: (minX + maxX) / 2, y: maxY + verticalOffset },
  };
}

export function resizeArrowPoints(
  points: readonly BoardPosition[],
  frame: ArrowTransformFrame,
  handle: ArrowResizeHandle,
  delta: BoardPosition,
  options: {
    preserveAspectRatio: boolean;
    fromCenter: boolean;
    minimumSize: number;
  },
): BoardPosition[] {
  const direction = HANDLE_DIRECTIONS[handle];
  const localDelta = projectVector(delta, frame.axisX, frame.axisY);
  const centerX = (frame.minX + frame.maxX) / 2;
  const centerY = (frame.minY + frame.maxY) / 2;
  const handleX =
    direction.x < 0 ? frame.minX : direction.x > 0 ? frame.maxX : centerX;
  const handleY =
    direction.y < 0 ? frame.minY : direction.y > 0 ? frame.maxY : centerY;
  const anchorX = options.fromCenter
    ? centerX
    : direction.x < 0
      ? frame.maxX
      : direction.x > 0
        ? frame.minX
        : centerX;
  const anchorY = options.fromCenter
    ? centerY
    : direction.y < 0
      ? frame.maxY
      : direction.y > 0
        ? frame.minY
        : centerY;
  let scaleX = direction.x
    ? scaleForDrag(
        handleX,
        anchorX,
        localDelta.x,
        frame.width,
        options.minimumSize,
      )
    : 1;
  let scaleY = direction.y
    ? scaleForDrag(
        handleY,
        anchorY,
        localDelta.y,
        frame.height,
        options.minimumSize,
      )
    : 1;

  if (options.preserveAspectRatio) {
    const candidate =
      direction.x && direction.y
        ? Math.abs(scaleX - 1) >= Math.abs(scaleY - 1)
          ? scaleX
          : scaleY
        : direction.x
          ? scaleX
          : scaleY;
    scaleX = frame.width > FRAME_EPSILON ? candidate : 1;
    scaleY = frame.height > FRAME_EPSILON ? candidate : 1;
  }

  return points.map((point) => {
    const local = projectPoint(point, frame.axisX, frame.axisY);
    return frameLocalToWorld(
      frame,
      anchorX + (local.x - anchorX) * scaleX,
      anchorY + (local.y - anchorY) * scaleY,
    );
  });
}

export function rotateArrowPoints(
  points: readonly BoardPosition[],
  center: BoardPosition,
  angle: number,
): BoardPosition[] {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return points.map((point) => {
    const x = point.x - center.x;
    const y = point.y - center.y;
    return {
      x: center.x + x * cosine - y * sine,
      y: center.y + x * sine + y * cosine,
    };
  });
}

export function snapArrowRotation(angle: number, increment = Math.PI / 12) {
  return Math.round(angle / increment) * increment;
}

export function normalizeArrowRotation(angle: number) {
  const turn = Math.PI * 2;
  const normalized = ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI;
  return Math.abs(normalized) <= FRAME_EPSILON ? 0 : normalized;
}

function scaleForDrag(
  handle: number,
  anchor: number,
  delta: number,
  size: number,
  minimumSize: number,
) {
  const span = handle - anchor;
  if (Math.abs(span) <= FRAME_EPSILON || size <= FRAME_EPSILON) return 1;
  const scale = (span + delta) / span;
  const minimumScale = Math.min(1, minimumSize / size);
  return Math.max(minimumScale, scale);
}

function frameLocalToWorld(
  frame: Pick<ArrowTransformFrame, "axisX" | "axisY">,
  x: number,
  y: number,
): BoardPosition {
  return unprojectPoint({ x, y }, frame.axisX, frame.axisY);
}

function projectPoint(
  point: BoardPosition,
  axisX: BoardPosition,
  axisY: BoardPosition,
): BoardPosition {
  return {
    x: point.x * axisX.x + point.y * axisX.y,
    y: point.x * axisY.x + point.y * axisY.y,
  };
}

function projectVector(
  vector: BoardPosition,
  axisX: BoardPosition,
  axisY: BoardPosition,
): BoardPosition {
  return projectPoint(vector, axisX, axisY);
}

function unprojectPoint(
  point: BoardPosition,
  axisX: BoardPosition,
  axisY: BoardPosition,
): BoardPosition {
  return {
    x: point.x * axisX.x + point.y * axisY.x,
    y: point.x * axisX.y + point.y * axisY.y,
  };
}
