import type { XYPosition } from "@xyflow/react";

export type CanvasAlignmentRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasAlignmentViewport = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type CanvasAlignmentGuideSegment = {
  coordinate: number;
  start: number;
  end: number;
};

export type CanvasAlignmentGuides = {
  vertical?: CanvasAlignmentGuideSegment;
  horizontal?: CanvasAlignmentGuideSegment;
};

export type CanvasAlignmentSnap = {
  offset: XYPosition;
  guides: CanvasAlignmentGuides;
};

const DEFAULT_ALIGNMENT_THRESHOLD_PX = 8;

/**
 * Finds a local edge or centre alignment for a rectangle being dragged on the
 * canvas. The alignment tolerance is expressed in screen pixels so the
 * interaction remains consistent at every zoom level. Callers decide which
 * candidates are eligible, such as limiting them to the current viewport.
 */
export function getCanvasAlignmentSnap({
  moving,
  candidates,
  zoom,
  thresholdPx = DEFAULT_ALIGNMENT_THRESHOLD_PX,
}: {
  moving: CanvasAlignmentRect;
  candidates: readonly CanvasAlignmentRect[];
  zoom: number;
  thresholdPx?: number;
}): CanvasAlignmentSnap | undefined {
  const safeZoom = Math.max(zoom, Number.EPSILON);
  const threshold = thresholdPx / safeZoom;
  const vertical = findClosestAlignment(
    moving,
    candidates,
    "vertical",
    threshold,
  );
  const horizontal = findClosestAlignment(
    moving,
    candidates,
    "horizontal",
    threshold,
  );

  if (!vertical && !horizontal) return undefined;

  const offset = {
    x: vertical?.offset ?? 0,
    y: horizontal?.offset ?? 0,
  };
  const alignedMoving = {
    ...moving,
    x: moving.x + offset.x,
    y: moving.y + offset.y,
  };

  return {
    offset,
    guides: {
      vertical: vertical
        ? makeGuideSegment(
            alignedMoving,
            vertical.candidate,
            "vertical",
            vertical.target,
          )
        : undefined,
      horizontal: horizontal
        ? makeGuideSegment(
            alignedMoving,
            horizontal.candidate,
            "horizontal",
            horizontal.target,
          )
        : undefined,
    },
  };
}

export function getVisibleCanvasAlignmentRects(
  rectangles: readonly CanvasAlignmentRect[],
  viewport: CanvasAlignmentViewport,
): CanvasAlignmentRect[] {
  return rectangles.filter(
    (rectangle) =>
      rectangle.x + rectangle.width >= viewport.left &&
      rectangle.x <= viewport.right &&
      rectangle.y + rectangle.height >= viewport.top &&
      rectangle.y <= viewport.bottom,
  );
}

export function getCanvasAlignmentBounds(
  rectangles: readonly CanvasAlignmentRect[],
): CanvasAlignmentRect | undefined {
  if (rectangles.length === 0) return undefined;

  let left = rectangles[0]!.x;
  let top = rectangles[0]!.y;
  let right = left + rectangles[0]!.width;
  let bottom = top + rectangles[0]!.height;

  for (let index = 1; index < rectangles.length; index += 1) {
    const rectangle = rectangles[index]!;
    left = Math.min(left, rectangle.x);
    top = Math.min(top, rectangle.y);
    right = Math.max(right, rectangle.x + rectangle.width);
    bottom = Math.max(bottom, rectangle.y + rectangle.height);
  }

  return {
    id: "dragged-selection",
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

type GuideOrientation = "vertical" | "horizontal";
type AxisSegment = { start: number; end: number; distance: number };
type AlignmentMatch = {
  offset: number;
  target: number;
  guideDistance: number;
  candidate: CanvasAlignmentRect;
};

function findClosestAlignment(
  moving: CanvasAlignmentRect,
  candidates: readonly CanvasAlignmentRect[],
  orientation: GuideOrientation,
  threshold: number,
): AlignmentMatch | undefined {
  const movingPoints = getAlignmentPoints(moving, orientation);
  let closest: AlignmentMatch | undefined;

  for (const candidate of candidates) {
    const guideAxis = getGuideAxisSegment(moving, candidate, orientation);
    if (!guideAxis) continue;

    const candidatePoints = getAlignmentPoints(candidate, orientation);
    for (let index = 0; index < movingPoints.length; index += 1) {
      const movingPoint = movingPoints[index]!;
      const candidatePoint = candidatePoints[index]!;
      const offset = candidatePoint - movingPoint;
      if (Math.abs(offset) > threshold) continue;

      const match = {
        offset,
        target: candidatePoint,
        guideDistance: guideAxis.distance,
        candidate,
      };
      if (isCloserMatch(match, closest)) closest = match;
    }
  }

  return closest;
}

function getAlignmentPoints(
  rectangle: CanvasAlignmentRect,
  orientation: GuideOrientation,
): [number, number, number] {
  if (orientation === "vertical") {
    return [
      rectangle.x,
      rectangle.x + rectangle.width / 2,
      rectangle.x + rectangle.width,
    ];
  }

  return [
    rectangle.y,
    rectangle.y + rectangle.height / 2,
    rectangle.y + rectangle.height,
  ];
}

function getGuideAxisSegment(
  moving: CanvasAlignmentRect,
  candidate: CanvasAlignmentRect,
  orientation: GuideOrientation,
): AxisSegment | undefined {
  return orientation === "vertical"
    ? getSeparatedSegment(
        moving.y,
        moving.y + moving.height,
        candidate.y,
        candidate.y + candidate.height,
      )
    : getSeparatedSegment(
        moving.x,
        moving.x + moving.width,
        candidate.x,
        candidate.x + candidate.width,
      );
}

function getSeparatedSegment(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): AxisSegment | undefined {
  if (firstEnd <= secondStart) {
    return {
      start: firstEnd,
      end: secondStart,
      distance: secondStart - firstEnd,
    };
  }
  if (secondEnd <= firstStart) {
    return {
      start: secondEnd,
      end: firstStart,
      distance: firstStart - secondEnd,
    };
  }

  return undefined;
}

function makeGuideSegment(
  moving: CanvasAlignmentRect,
  candidate: CanvasAlignmentRect,
  orientation: GuideOrientation,
  coordinate: number,
): CanvasAlignmentGuideSegment | undefined {
  const segment = getGuideAxisSegment(moving, candidate, orientation);
  return segment
    ? { coordinate, start: segment.start, end: segment.end }
    : undefined;
}

function isCloserMatch(
  next: AlignmentMatch,
  current: AlignmentMatch | undefined,
): boolean {
  if (!current) return true;
  if (next.guideDistance !== current.guideDistance) {
    return next.guideDistance < current.guideDistance;
  }

  const nextAlignmentDistance = Math.abs(next.offset);
  const currentAlignmentDistance = Math.abs(current.offset);
  if (nextAlignmentDistance !== currentAlignmentDistance) {
    return nextAlignmentDistance < currentAlignmentDistance;
  }
  if (next.candidate.id !== current.candidate.id) {
    return next.candidate.id < current.candidate.id;
  }
  return next.target < current.target;
}
