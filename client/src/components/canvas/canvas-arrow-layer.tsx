import { useState } from "react";
import { ViewportPortal, useReactFlow, type Node } from "@xyflow/react";
import { Trash2Icon } from "lucide-react";

import type {
  BoardPosition,
  CanvasArrowEndpoint,
  CanvasArrowHead,
  CanvasArrowObject,
  CanvasArrowPattern,
  CanvasArrowRouting,
  CanvasArrowStyle,
  CanvasObjectColor,
} from "@/api/collection";
import { cn } from "@/lib/utils";
import {
  CANVAS_OBJECT_COLORS,
  arrowDashArray,
  canvasObjectColor,
} from "./canvas-object-style";

export type DraftCanvasArrow = Pick<
  CanvasArrowObject,
  | "start"
  | "end"
  | "style"
  | "pattern"
  | "head"
  | "routing"
  | "points"
  | "color"
>;

type ArrowGeometry = Pick<
  CanvasArrowObject,
  "start" | "end" | "points" | "routing"
>;
type ArrowUpdate = Partial<
  Pick<
    CanvasArrowObject,
    | "start"
    | "end"
    | "style"
    | "pattern"
    | "head"
    | "routing"
    | "points"
    | "color"
  >
>;

export function CanvasArrowLayer({
  arrows,
  draft,
  selectedIds,
  enabled,
  onSelect,
  onUpdate,
  onDelete,
}: {
  arrows: CanvasArrowObject[];
  draft?: DraftCanvasArrow;
  selectedIds: ReadonlySet<string>;
  enabled: boolean;
  onSelect: (id: string, event: React.PointerEvent) => void;
  onUpdate: (
    id: string,
    update: ArrowUpdate,
    callbacks?: { onSettled?: () => void },
  ) => void;
  onDelete: (id: string) => void;
}) {
  const { getNode, getNodes, getViewport, screenToFlowPosition } =
    useReactFlow<Node>();
  const [previews, setPreviews] = useState<Record<string, ArrowGeometry>>({});
  const [draggingId, setDraggingId] = useState<string>();

  const resolveEndpoint = (endpoint: CanvasArrowEndpoint) => {
    const target = endpoint.binding
      ? getNode(endpoint.binding.targetId)
      : undefined;
    if (!target) return endpoint.position;
    const width = target.measured?.width ?? target.width ?? 0;
    const height = target.measured?.height ?? target.height ?? 0;
    return {
      x: target.position.x + width * endpoint.binding!.anchor.x,
      y: target.position.y + height * endpoint.binding!.anchor.y,
    };
  };

  const bindEndpoint = (
    position: BoardPosition,
    excludedId: string,
  ): CanvasArrowEndpoint => {
    const padding = 16 / getViewport().zoom;
    const target = getNodes()
      .filter((node) => node.id !== excludedId)
      .map((node) => {
        const width = node.measured?.width ?? node.width ?? 0;
        const height = node.measured?.height ?? node.height ?? 0;
        const left = node.position.x;
        const top = node.position.y;
        const nearest = {
          x: Math.min(left + width, Math.max(left, position.x)),
          y: Math.min(top + height, Math.max(top, position.y)),
        };
        return {
          node,
          width,
          height,
          nearest,
          distance: Math.hypot(position.x - nearest.x, position.y - nearest.y),
        };
      })
      .filter((candidate) => candidate.distance <= padding)
      .sort((left, right) => left.distance - right.distance)[0];
    if (!target || target.width <= 0 || target.height <= 0) {
      return { position: roundPoint(position) };
    }
    return {
      position: roundPoint(target.nearest),
      binding: {
        targetId: target.node.id,
        anchor: {
          x: clamp((target.nearest.x - target.node.position.x) / target.width),
          y: clamp((target.nearest.y - target.node.position.y) / target.height),
        },
      },
    };
  };

  const clearPreview = (id: string) => {
    setPreviews((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const beginDrag = (
    event: React.PointerEvent,
    arrow: CanvasArrowObject,
    part: "start" | "end" | "body",
  ) => {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(arrow.id, event);
    setDraggingId(arrow.id);
    const pointerStart = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const initial = resolvedGeometry(arrow, resolveEndpoint);
    let didMove = false;
    const move = (moveEvent: PointerEvent) => {
      const point = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const delta = {
        x: point.x - pointerStart.x,
        y: point.y - pointerStart.y,
      };
      didMove ||= Math.hypot(delta.x, delta.y) > 1;
      setPreviews((current) => ({
        ...current,
        [arrow.id]: {
          start:
            part === "end"
              ? initial.start
              : { position: addPoint(initial.start.position, delta) },
          end:
            part === "start"
              ? initial.end
              : { position: addPoint(initial.end.position, delta) },
          points:
            part === "body"
              ? initial.points.map((bend) => addPoint(bend, delta))
              : initial.points,
          routing: initial.routing,
        },
      }));
    };
    const up = (upEvent: PointerEvent) => {
      cleanup();
      setDraggingId(undefined);
      if (!didMove) {
        clearPreview(arrow.id);
        return;
      }
      const point = screenToFlowPosition({
        x: upEvent.clientX,
        y: upEvent.clientY,
      });
      const delta = {
        x: point.x - pointerStart.x,
        y: point.y - pointerStart.y,
      };
      const update: ArrowGeometry = {
        start:
          part === "end"
            ? arrow.start
            : part === "start"
              ? bindEndpoint(addPoint(initial.start.position, delta), arrow.id)
              : {
                  position: roundPoint(addPoint(initial.start.position, delta)),
                },
        end:
          part === "start"
            ? arrow.end
            : part === "end"
              ? bindEndpoint(addPoint(initial.end.position, delta), arrow.id)
              : { position: roundPoint(addPoint(initial.end.position, delta)) },
        points:
          part === "body"
            ? initial.points.map((bend) => roundPoint(addPoint(bend, delta)))
            : arrow.points,
        routing: arrow.routing,
      };
      setPreviews((current) => ({ ...current, [arrow.id]: update }));
      onUpdate(arrow.id, update, { onSettled: () => clearPreview(arrow.id) });
    };
    const cancel = () => {
      cleanup();
      setDraggingId(undefined);
      clearPreview(arrow.id);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  };

  const beginBendDrag = (
    event: React.PointerEvent,
    arrow: CanvasArrowObject,
    index: number,
    insert: boolean,
  ) => {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(arrow.id, event);
    setDraggingId(arrow.id);
    const geometry = resolvedGeometry(arrow, resolveEndpoint);
    const initialPoints = insert
      ? insertPoint(geometry.points, index, midpointForSegment(geometry, index))
      : geometry.points;
    const pointerStart = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    let didMove = false;
    let latestPoints = initialPoints;
    const move = (moveEvent: PointerEvent) => {
      const point = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const delta = {
        x: point.x - pointerStart.x,
        y: point.y - pointerStart.y,
      };
      didMove ||= Math.hypot(delta.x, delta.y) > 1;
      latestPoints = initialPoints.map((bend, bendIndex) =>
        bendIndex === index ? addPoint(bend, delta) : bend,
      );
      setPreviews((current) => ({
        ...current,
        [arrow.id]: { ...geometry, points: latestPoints, routing: "smooth" },
      }));
    };
    const up = () => {
      cleanup();
      setDraggingId(undefined);
      if (!didMove) {
        clearPreview(arrow.id);
        return;
      }
      const points = latestPoints.map(roundPoint);
      setPreviews((current) => ({
        ...current,
        [arrow.id]: { ...geometry, points, routing: "smooth" },
      }));
      onUpdate(
        arrow.id,
        { points, routing: "smooth" },
        { onSettled: () => clearPreview(arrow.id) },
      );
    };
    const cancel = () => {
      cleanup();
      setDraggingId(undefined);
      clearPreview(arrow.id);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  };

  const rendered = draft
    ? [
        ...arrows,
        {
          id: "arrow-draft",
          type: "arrow" as const,
          ...draft,
          createdAt: "",
          updatedAt: "",
        },
      ]
    : arrows;

  return (
    <ViewportPortal>
      <svg
        className="pointer-events-none absolute top-0 left-0 z-0 overflow-visible"
        width="1"
        height="1"
        aria-label="Canvas arrows"
      >
        <defs>
          {CANVAS_OBJECT_COLORS.flatMap((color) =>
            (["filled", "hollow", "chevron"] as CanvasArrowHead[]).map(
              (head) => (
                <ArrowMarker
                  key={`${color}-${head}`}
                  color={color}
                  head={head}
                />
              ),
            ),
          )}
        </defs>
        {rendered.map((arrow) => {
          const preview = previews[arrow.id];
          const geometry = preview
            ? resolvedGeometry({ ...arrow, ...preview }, resolveEndpoint)
            : resolvedGeometry(arrow, resolveEndpoint);
          const points = geometryPoints(geometry);
          const selected = selectedIds.has(arrow.id);
          const path = makeArrowPath(
            arrow.id,
            points,
            arrow.style,
            geometry.routing,
          );
          const endpointHandles = endpointHandlePositions(
            points,
            getViewport().zoom,
          );
          return (
            <g
              key={arrow.id}
              className={cn(
                (arrow.id === "arrow-draft" || draggingId === arrow.id) &&
                  "opacity-65",
              )}
            >
              {selected ? (
                <path
                  d={path}
                  fill="none"
                  stroke="var(--background)"
                  strokeWidth="6"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}
              <path
                d={path}
                fill="none"
                stroke={canvasObjectColor(arrow.color)}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={arrowDashArray(arrow.pattern)}
                vectorEffect="non-scaling-stroke"
                markerEnd={`url(#aska-arrowhead-${arrow.color}-${arrow.head})`}
              />
              {arrow.id !== "arrow-draft" ? (
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="16"
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-auto cursor-move"
                  data-selection-node-id={arrow.id}
                  onPointerDown={(event) => beginDrag(event, arrow, "body")}
                />
              ) : null}
              {selected ? (
                <>
                  <circle
                    cx={endpointHandles.start.x}
                    cy={endpointHandles.start.y}
                    r="5"
                    fill="var(--background)"
                    stroke={canvasObjectColor(arrow.color)}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-auto cursor-crosshair"
                    onPointerDown={(event) => beginDrag(event, arrow, "start")}
                  />
                  <circle
                    cx={endpointHandles.end.x}
                    cy={endpointHandles.end.y}
                    r="5"
                    fill="var(--background)"
                    stroke={canvasObjectColor(arrow.color)}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-auto cursor-crosshair"
                    onPointerDown={(event) => beginDrag(event, arrow, "end")}
                  />
                  {geometry.points.map((point, index) => (
                    <circle
                      key={`point-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r="5"
                      fill="var(--background)"
                      stroke={canvasObjectColor(arrow.color)}
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                      className="pointer-events-auto cursor-grab active:cursor-grabbing"
                      onPointerDown={(event) =>
                        beginBendDrag(event, arrow, index, false)
                      }
                    />
                  ))}
                  {segmentMidpoints(geometry).map((point, index) => (
                    <rect
                      key={`insert-${index}`}
                      x={point.x - 3}
                      y={point.y - 3}
                      width="6"
                      height="6"
                      rx="1"
                      fill="var(--background)"
                      stroke={canvasObjectColor(arrow.color)}
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                      transform={`rotate(45 ${point.x} ${point.y})`}
                      className="pointer-events-auto cursor-crosshair"
                      onPointerDown={(event) =>
                        beginBendDrag(event, arrow, index, true)
                      }
                    />
                  ))}
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
      {arrows.map((arrow) => {
        if (!selectedIds.has(arrow.id)) return null;
        const preview = previews[arrow.id];
        const geometry = preview
          ? resolvedGeometry({ ...arrow, ...preview }, resolveEndpoint)
          : resolvedGeometry(arrow, resolveEndpoint);
        return (
          <ArrowToolbar
            key={`${arrow.id}-toolbar`}
            arrow={preview ? { ...arrow, ...preview } : arrow}
            position={toolbarPosition(geometry)}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        );
      })}
    </ViewportPortal>
  );
}

function ArrowMarker({
  color,
  head,
}: {
  color: CanvasObjectColor;
  head: CanvasArrowHead;
}) {
  const stroke = canvasObjectColor(color);
  return (
    <marker
      id={`aska-arrowhead-${color}-${head}`}
      markerWidth="9"
      markerHeight="9"
      refX="8"
      refY="4"
      orient="auto"
      markerUnits="strokeWidth"
    >
      {head === "filled" ? (
        <path d="M 0 0 L 8 4 L 0 8 z" fill={stroke} />
      ) : head === "hollow" ? (
        <path
          d="M .75 .75 L 8 4 L .75 7.25 z"
          fill="var(--background)"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M .75 .75 L 8 4 L .75 7.25"
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </marker>
  );
}

function ArrowToolbar({
  arrow,
  position,
  onUpdate,
  onDelete,
}: {
  arrow: CanvasArrowObject;
  position: BoardPosition;
  onUpdate: (id: string, update: ArrowUpdate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Arrow style"
      className="nodrag nopan nowheel absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur"
      style={{ left: position.x, top: position.y, pointerEvents: "all" }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {(["clean", "sketch"] as CanvasArrowStyle[]).map((style) => (
        <button
          key={style}
          type="button"
          className={cn(
            "h-7 cursor-pointer rounded-md px-2 text-xs capitalize hover:bg-accent",
            arrow.style === style && "bg-accent",
          )}
          aria-pressed={arrow.style === style}
          onClick={() => onUpdate(arrow.id, { style })}
        >
          {style}
        </button>
      ))}
      <ToolbarDivider />
      {(["straight", "smooth"] as CanvasArrowRouting[]).map((routing) => (
        <button
          key={routing}
          type="button"
          className={cn(
            "h-7 cursor-pointer rounded-md px-2 text-xs hover:bg-accent",
            arrow.routing === routing && "bg-accent",
          )}
          aria-label={`${routing} arrow path`}
          aria-pressed={arrow.routing === routing}
          onClick={() => onUpdate(arrow.id, { routing })}
        >
          {routing === "straight" ? "Line" : "Curve"}
        </button>
      ))}
      <ToolbarDivider />
      {(["filled", "hollow", "chevron"] as CanvasArrowHead[]).map((head) => (
        <button
          key={head}
          type="button"
          className={cn(
            "flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-accent",
            arrow.head === head && "bg-accent",
          )}
          aria-label={`${head} arrowhead`}
          aria-pressed={arrow.head === head}
          onClick={() => onUpdate(arrow.id, { head })}
        >
          <ArrowheadGlyph head={head} />
        </button>
      ))}
      <ToolbarDivider />
      {(["solid", "dashed", "dotted"] as CanvasArrowPattern[]).map(
        (pattern) => (
          <button
            key={pattern}
            type="button"
            className={cn(
              "h-7 cursor-pointer rounded-md px-2 text-[11px] capitalize hover:bg-accent",
              arrow.pattern === pattern && "bg-accent",
            )}
            aria-pressed={arrow.pattern === pattern}
            onClick={() => onUpdate(arrow.id, { pattern })}
          >
            {pattern}
          </button>
        ),
      )}
      <ToolbarDivider />
      {CANVAS_OBJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "size-5 cursor-pointer rounded-full border border-black/10 ring-offset-2 ring-offset-popover",
            arrow.color === color && "ring-2 ring-ring",
          )}
          style={{ backgroundColor: canvasObjectColor(color) }}
          aria-label={`${color} arrow color`}
          aria-pressed={arrow.color === color}
          onClick={() => onUpdate(arrow.id, { color })}
        />
      ))}
      <ToolbarDivider />
      <button
        type="button"
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label="Delete arrow"
        onClick={() => onDelete(arrow.id)}
      >
        <Trash2Icon className="size-3.5" />
      </button>
    </div>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

function ArrowheadGlyph({ head }: { head: CanvasArrowHead }) {
  return (
    <svg viewBox="0 0 20 12" className="h-3 w-5" aria-hidden="true">
      <path d="M 1 6 H 14" stroke="currentColor" strokeWidth="1.75" />
      {head === "filled" ? (
        <path d="M 13 1 L 19 6 L 13 11 z" fill="currentColor" />
      ) : head === "hollow" ? (
        <path
          d="M 13 1 L 19 6 L 13 11 z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ) : (
        <path
          d="M 13 1 L 19 6 L 13 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
      )}
    </svg>
  );
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
  if (points.length < 2) return "";
  if (
    style === "sketch" &&
    resolvedRouting === "straight" &&
    points.length === 2
  ) {
    const [start, end] = points;
    const hash = [...id].reduce((value, char) => value + char.charCodeAt(0), 0);
    const dx = end!.x - start!.x;
    const dy = end!.y - start!.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const bend = ((hash % 11) - 5) * Math.min(1, length / 180);
    const normal = { x: -dy / length, y: dx / length };
    return `M ${start!.x} ${start!.y} Q ${(start!.x + end!.x) / 2 + normal.x * bend} ${(start!.y + end!.y) / 2 + normal.y * bend} ${end!.x} ${end!.y}`;
  }
  if (resolvedRouting === "straight")
    return `M ${points[0]!.x} ${points[0]!.y}${points
      .slice(1)
      .map((point) => ` L ${point.x} ${point.y}`)
      .join("")}`;
  return catmullRomPath(points);
}

function resolvedGeometry(
  arrow: Pick<CanvasArrowObject, "start" | "end" | "points" | "routing">,
  resolveEndpoint: (endpoint: CanvasArrowEndpoint) => BoardPosition,
): ArrowGeometry {
  return {
    start: { position: resolveEndpoint(arrow.start) },
    end: { position: resolveEndpoint(arrow.end) },
    points: arrow.points,
    routing: arrow.routing,
  };
}
function geometryPoints(geometry: ArrowGeometry) {
  return [geometry.start.position, ...geometry.points, geometry.end.position];
}
function midpointForSegment(geometry: ArrowGeometry, index: number) {
  const points = geometryPoints(geometry);
  return midpoint(points[index]!, points[index + 1]!);
}
function segmentMidpoints(geometry: ArrowGeometry) {
  const points = geometryPoints(geometry);
  return points
    .slice(0, -1)
    .map((point, index) => midpoint(point, points[index + 1]!));
}
function toolbarPosition(geometry: ArrowGeometry) {
  const points = geometryPoints(geometry);
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: Math.min(...points.map((point) => point.y)) - 18,
  };
}
function endpointHandlePositions(points: BoardPosition[], zoom: number) {
  // A 5px-radius handle sits just beyond the visible endpoint instead of
  // covering the arrowhead or line cap.
  const distance = 6 / zoom;
  const start = points[0]!;
  const end = points.at(-1)!;
  const startDirection = unitVector(start, points[1] ?? end);
  const endDirection = unitVector(points.at(-2) ?? start, end);
  return {
    start: addPoint(start, {
      x: -startDirection.x * distance,
      y: -startDirection.y * distance,
    }),
    end: addPoint(end, {
      x: endDirection.x * distance,
      y: endDirection.y * distance,
    }),
  };
}
function catmullRomPath(points: BoardPosition[]) {
  let path = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const afterNext = points[index + 2] ?? next;
    path += ` C ${current.x + (next.x - previous.x) / 6} ${current.y + (next.y - previous.y) / 6} ${next.x - (afterNext.x - current.x) / 6} ${next.y - (afterNext.y - current.y) / 6} ${next.x} ${next.y}`;
  }
  return path;
}
function insertPoint(
  points: BoardPosition[],
  index: number,
  point: BoardPosition,
) {
  return [...points.slice(0, index), point, ...points.slice(index)];
}
function midpoint(first: BoardPosition, second: BoardPosition): BoardPosition {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}
function unitVector(from: BoardPosition, to: BoardPosition) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}
function addPoint(point: BoardPosition, delta: BoardPosition): BoardPosition {
  return { x: point.x + delta.x, y: point.y + delta.y };
}
function roundPoint(point: BoardPosition): BoardPosition {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}
function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
