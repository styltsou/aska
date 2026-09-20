import type {
  BoardPosition,
  CanvasArrowHead,
  CanvasArrowRouting,
  CanvasArrowStyle,
} from "@/api/collection";

const SKETCH_SEED_SALT = "aska-canvas-arrow-v1";

export type ArrowPaths = {
  canonical: string;
  primary: string;
  secondary?: string;
  segmentAnchors: BoardPosition[];
  secondarySegmentAnchors?: BoardPosition[];
};

type RenderedPath = {
  d: string;
  segmentAnchors: BoardPosition[];
};

export type ArrowheadSketchJitter = {
  tipY: number;
  leftX: number;
  leftY: number;
  rightX: number;
  rightY: number;
};

export function makeArrowPaths(
  id: string,
  points: BoardPosition[],
  style: CanvasArrowStyle,
  routing: CanvasArrowRouting,
): ArrowPaths {
  const canonical = cleanArrowPath(points, routing);
  if (style === "clean" || points.length < 2) {
    return {
      canonical: canonical.d,
      primary: canonical.d,
      segmentAnchors: canonical.segmentAnchors,
    };
  }

  const primary = sketchArrowPath(
    points,
    routing,
    seededRandom(id, "shaft-1"),
    {
      bow: 4,
      endpointDrift: 0.65,
      pointDrift: 0.9,
      normalOffset: -0.4,
    },
  );
  let secondaryOffset = 1.5;
  let secondary = sketchArrowPath(
    points,
    routing,
    seededRandom(id, "shaft-2"),
    {
      bow: 5.25,
      endpointDrift: 0.9,
      pointDrift: 1.2,
      normalOffset: secondaryOffset,
    },
  );
  while (
    secondaryOffset < 6 &&
    !passesHaveVisibleSeparation(primary, secondary, 1.25)
  ) {
    secondaryOffset += 1.5;
    secondary = sketchArrowPath(points, routing, seededRandom(id, "shaft-2"), {
      bow: 5.25,
      endpointDrift: 0.9,
      pointDrift: 1.2,
      normalOffset: secondaryOffset,
    });
  }

  return {
    canonical: canonical.d,
    primary: primary.d,
    secondary: secondary.d,
    segmentAnchors: primary.segmentAnchors,
    secondarySegmentAnchors: secondary.segmentAnchors,
  };
}

export function arrowheadSketchJitter(
  id: string,
  pass: "primary" | "secondary",
): ArrowheadSketchJitter {
  const random = seededRandom(id, `head-${pass}`);
  const scale = pass === "primary" ? 1 : 1.18;
  const spread = (magnitude: number) => centered(random, magnitude * scale);
  return {
    tipY: roundTo(spread(1.3), 3),
    leftX: roundTo(spread(1.05), 3),
    leftY: roundTo(spread(1.05), 3),
    rightX: roundTo(spread(1.05), 3),
    rightY: roundTo(spread(1.05), 3),
  };
}

export function arrowMarkerRefX(
  style: CanvasArrowStyle,
  head: CanvasArrowHead,
) {
  return style === "clean" && head === "filled" ? 7.25 : 8;
}

export function makeArrowPath(
  id: string,
  points: BoardPosition[],
  style: CanvasArrowStyle,
  routing: CanvasArrowRouting,
): string;
/** Legacy straight-arrow signature retained for the small path unit tests. */
export function makeArrowPath(
  id: string,
  start: BoardPosition,
  end: BoardPosition,
  style: CanvasArrowStyle,
): string;
export function makeArrowPath(
  id: string,
  pointsOrStart: BoardPosition[] | BoardPosition,
  styleOrEnd: CanvasArrowStyle | BoardPosition,
  routingOrStyle: CanvasArrowRouting | CanvasArrowStyle,
  routing: CanvasArrowRouting = "straight",
) {
  const points = Array.isArray(pointsOrStart)
    ? pointsOrStart
    : [pointsOrStart, styleOrEnd as BoardPosition];
  const style = (
    Array.isArray(pointsOrStart) ? styleOrEnd : routingOrStyle
  ) as CanvasArrowStyle;
  const resolvedRouting = (
    Array.isArray(pointsOrStart) ? routingOrStyle : routing
  ) as CanvasArrowRouting;
  return makeArrowPaths(id, points, style, resolvedRouting).primary;
}

function cleanArrowPath(
  points: BoardPosition[],
  routing: CanvasArrowRouting,
): RenderedPath {
  if (points.length < 2) return { d: "", segmentAnchors: [] };
  if (routing === "straight") {
    return {
      d: `M ${points[0]!.x} ${points[0]!.y}${points
        .slice(1)
        .map((point) => ` L ${point.x} ${point.y}`)
        .join("")}`,
      segmentAnchors: points
        .slice(0, -1)
        .map((point, index) => midpoint(point, points[index + 1]!)),
    };
  }
  return catmullRomPath(points);
}

function sketchArrowPath(
  points: BoardPosition[],
  routing: CanvasArrowRouting,
  random: () => number,
  roughness: {
    bow: number;
    endpointDrift: number;
    pointDrift: number;
    normalOffset: number;
  },
): RenderedPath {
  const sketchedPoints = points.map((point, index) => {
    // Both pen passes meet the marker at the canonical tip. Letting the final
    // point drift makes the lighter pass peek out beside small arrowheads.
    if (index === points.length - 1) return point;
    const drift = index === 0 ? roughness.endpointDrift : roughness.pointDrift;
    const normal = localNormal(points, index);
    return {
      x: point.x + centered(random, drift) + normal.x * roughness.normalOffset,
      y: point.y + centered(random, drift) + normal.y * roughness.normalOffset,
    };
  });

  if (routing === "smooth" && points.length > 2) {
    return catmullRomPath(sketchedPoints, true);
  }

  let path = `M ${pathNumber(sketchedPoints[0]!.x)} ${pathNumber(sketchedPoints[0]!.y)}`;
  const segmentAnchors: BoardPosition[] = [];
  for (let index = 0; index < sketchedPoints.length - 1; index += 1) {
    const originalStart = points[index]!;
    const originalEnd = points[index + 1]!;
    const start = sketchedPoints[index]!;
    const end = sketchedPoints[index + 1]!;
    const dx = originalEnd.x - originalStart.x;
    const dy = originalEnd.y - originalStart.y;
    const length = Math.hypot(dx, dy);
    const normal =
      length > 0 ? { x: -dy / length, y: dx / length } : { x: 0, y: 0 };
    const bow = centered(random, Math.min(roughness.bow, length * 0.045));
    const along = centered(random, Math.min(0.35, length * 0.01));
    const tangent =
      length > 0 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
    const midX = (start.x + end.x) / 2 + normal.x * bow + tangent.x * along;
    const midY = (start.y + end.y) / 2 + normal.y * bow + tangent.y * along;
    segmentAnchors.push(quadraticPoint(start, { x: midX, y: midY }, end, 0.5));
    path += ` Q ${pathNumber(midX)} ${pathNumber(midY)} ${pathNumber(end.x)} ${pathNumber(end.y)}`;
  }
  return { d: path, segmentAnchors };
}

function catmullRomPath(
  points: BoardPosition[],
  compact = false,
): RenderedPath {
  if (points.length === 0) return { d: "", segmentAnchors: [] };
  const number = compact ? pathNumber : (value: number) => value;
  let path = `M ${number(points[0]!.x)} ${number(points[0]!.y)}`;
  const segmentAnchors: BoardPosition[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const afterNext = points[index + 2] ?? next;
    const firstControl = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const secondControl = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    };
    segmentAnchors.push(
      cubicPoint(current, firstControl, secondControl, next, 0.5),
    );
    path += ` C ${number(firstControl.x)} ${number(firstControl.y)} ${number(secondControl.x)} ${number(secondControl.y)} ${number(next.x)} ${number(next.y)}`;
  }
  return { d: path, segmentAnchors };
}

function passesHaveVisibleSeparation(
  primary: RenderedPath,
  secondary: RenderedPath,
  minimum: number,
) {
  return primary.segmentAnchors.every((anchor, index) => {
    const other = secondary.segmentAnchors[index];
    return (
      !other || Math.hypot(anchor.x - other.x, anchor.y - other.y) >= minimum
    );
  });
}

function localNormal(points: BoardPosition[], index: number) {
  const point = points[index]!;
  const previous = points[index - 1] ?? point;
  const next = points[index + 1] ?? point;
  let dx = next.x - previous.x;
  let dy = next.y - previous.y;
  let length = Math.hypot(dx, dy);
  if (length === 0 && index < points.length - 1) {
    dx = next.x - point.x;
    dy = next.y - point.y;
    length = Math.hypot(dx, dy);
  }
  if (length === 0 && index > 0) {
    dx = point.x - previous.x;
    dy = point.y - previous.y;
    length = Math.hypot(dx, dy);
  }
  return length > 0 ? { x: -dy / length, y: dx / length } : { x: 0, y: 0 };
}

function midpoint(first: BoardPosition, second: BoardPosition) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function quadraticPoint(
  start: BoardPosition,
  control: BoardPosition,
  end: BoardPosition,
  progress: number,
) {
  const remaining = 1 - progress;
  return {
    x:
      remaining * remaining * start.x +
      2 * remaining * progress * control.x +
      progress * progress * end.x,
    y:
      remaining * remaining * start.y +
      2 * remaining * progress * control.y +
      progress * progress * end.y,
  };
}

function cubicPoint(
  start: BoardPosition,
  firstControl: BoardPosition,
  secondControl: BoardPosition,
  end: BoardPosition,
  progress: number,
) {
  const remaining = 1 - progress;
  return {
    x:
      remaining ** 3 * start.x +
      3 * remaining ** 2 * progress * firstControl.x +
      3 * remaining * progress ** 2 * secondControl.x +
      progress ** 3 * end.x,
    y:
      remaining ** 3 * start.y +
      3 * remaining ** 2 * progress * firstControl.y +
      3 * remaining * progress ** 2 * secondControl.y +
      progress ** 3 * end.y,
  };
}

function seededRandom(id: string, channel: string) {
  return mulberry32(hashString(`${SKETCH_SEED_SALT}:${id}:${channel}`));
}

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function centered(random: () => number, radius: number) {
  return (random() * 2 - 1) * radius;
}

function pathNumber(value: number) {
  return roundTo(value, 2);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
