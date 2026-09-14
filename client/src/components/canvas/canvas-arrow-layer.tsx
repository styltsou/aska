import { useState } from "react";
import { ViewportPortal, useReactFlow, type Node } from "@xyflow/react";

import type {
  CanvasArrowEndpoint,
  CanvasArrowObject,
  CanvasArrowPattern,
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
  "start" | "end" | "style" | "pattern" | "color"
>;

type ArrowPoints = {
  start: CanvasArrowEndpoint;
  end: CanvasArrowEndpoint;
};

export function CanvasArrowLayer({
  arrows,
  draft,
  selectedIds,
  enabled,
  onSelect,
  onUpdate,
}: {
  arrows: CanvasArrowObject[];
  draft?: DraftCanvasArrow;
  selectedIds: ReadonlySet<string>;
  enabled: boolean;
  onSelect: (id: string, event: React.PointerEvent) => void;
  onUpdate: (
    id: string,
    update: Partial<
      Pick<CanvasArrowObject, "start" | "end" | "style" | "pattern" | "color">
    >,
  ) => void;
}) {
  const { getNode, getNodes, getViewport, screenToFlowPosition } =
    useReactFlow<Node>();
  const [previews, setPreviews] = useState<Record<string, ArrowPoints>>({});

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
    position: { x: number; y: number },
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
    const anchor = {
      x: clamp((target.nearest.x - target.node.position.x) / target.width),
      y: clamp((target.nearest.y - target.node.position.y) / target.height),
    };
    return {
      position: roundPoint(target.nearest),
      binding: { targetId: target.node.id, anchor },
    };
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
    const pointerStart = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const initial = {
      start: { position: resolveEndpoint(arrow.start) },
      end: { position: resolveEndpoint(arrow.end) },
    } satisfies ArrowPoints;

    const move = (moveEvent: PointerEvent) => {
      const point = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const delta = {
        x: point.x - pointerStart.x,
        y: point.y - pointerStart.y,
      };
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
        },
      }));
    };
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      const point = screenToFlowPosition({
        x: upEvent.clientX,
        y: upEvent.clientY,
      });
      const delta = {
        x: point.x - pointerStart.x,
        y: point.y - pointerStart.y,
      };
      const update: ArrowPoints = {
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
      };
      setPreviews((current) => {
        const next = { ...current };
        delete next[arrow.id];
        return next;
      });
      onUpdate(arrow.id, update);
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      setPreviews((current) => {
        const next = { ...current };
        delete next[arrow.id];
        return next;
      });
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
          {CANVAS_OBJECT_COLORS.map((color) => (
            <marker
              key={color}
              id={`aska-arrowhead-${color}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill={canvasObjectColor(color)} />
            </marker>
          ))}
        </defs>
        {rendered.map((arrow) => {
          const preview = previews[arrow.id];
          const start = preview?.start.position ?? resolveEndpoint(arrow.start);
          const end = preview?.end.position ?? resolveEndpoint(arrow.end);
          const selected = selectedIds.has(arrow.id);
          const path = makeArrowPath(arrow.id, start, end, arrow.style);
          return (
            <g
              key={arrow.id}
              className={arrow.id === "arrow-draft" ? "opacity-65" : undefined}
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
                markerEnd={`url(#aska-arrowhead-${arrow.color})`}
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
                    cx={start.x}
                    cy={start.y}
                    r="6"
                    fill="var(--background)"
                    stroke={canvasObjectColor(arrow.color)}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-auto cursor-crosshair"
                    onPointerDown={(event) => beginDrag(event, arrow, "start")}
                  />
                  <circle
                    cx={end.x}
                    cy={end.y}
                    r="6"
                    fill="var(--background)"
                    stroke={canvasObjectColor(arrow.color)}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-auto cursor-crosshair"
                    onPointerDown={(event) => beginDrag(event, arrow, "end")}
                  />
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
      {arrows.map((arrow) => {
        if (!selectedIds.has(arrow.id)) return null;
        const start = resolveEndpoint(arrow.start);
        const end = resolveEndpoint(arrow.end);
        return (
          <ArrowToolbar
            key={`${arrow.id}-toolbar`}
            arrow={arrow}
            position={{
              x: (start.x + end.x) / 2,
              y: Math.min(start.y, end.y) - 18,
            }}
            onUpdate={onUpdate}
          />
        );
      })}
    </ViewportPortal>
  );
}

function ArrowToolbar({
  arrow,
  position,
  onUpdate,
}: {
  arrow: CanvasArrowObject;
  position: { x: number; y: number };
  onUpdate: (id: string, update: Partial<CanvasArrowObject>) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Arrow style"
      className="nodrag nowheel absolute z-30 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur"
      style={{ left: position.x, top: position.y }}
    >
      {(["clean", "sketch"] as CanvasArrowStyle[]).map((style) => (
        <button
          key={style}
          type="button"
          className={cn(
            "h-7 rounded-md px-2 text-xs capitalize hover:bg-accent",
            arrow.style === style && "bg-accent",
          )}
          aria-pressed={arrow.style === style}
          onClick={() => onUpdate(arrow.id, { style })}
        >
          {style}
        </button>
      ))}
      <span className="mx-0.5 h-5 w-px bg-border" />
      {(["solid", "dashed", "dotted"] as CanvasArrowPattern[]).map(
        (pattern) => (
          <button
            key={pattern}
            type="button"
            className={cn(
              "h-7 rounded-md px-2 text-[11px] capitalize hover:bg-accent",
              arrow.pattern === pattern && "bg-accent",
            )}
            aria-pressed={arrow.pattern === pattern}
            onClick={() => onUpdate(arrow.id, { pattern })}
          >
            {pattern}
          </button>
        ),
      )}
      <span className="mx-0.5 h-5 w-px bg-border" />
      {CANVAS_OBJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={cn(
            "size-5 rounded-full border border-black/10 ring-offset-2 ring-offset-popover",
            arrow.color === color && "ring-2 ring-ring",
          )}
          style={{ backgroundColor: canvasObjectColor(color) }}
          aria-label={`${color} arrow color`}
          aria-pressed={arrow.color === color}
          onClick={() =>
            onUpdate(arrow.id, { color: color as CanvasObjectColor })
          }
        />
      ))}
    </div>
  );
}

export function makeArrowPath(
  id: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  style: CanvasArrowStyle,
) {
  if (style === "clean") return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const hash = [...id].reduce((value, char) => value + char.charCodeAt(0), 0);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = ((hash % 11) - 5) * Math.min(1, length / 180);
  const normal = { x: -dy / length, y: dx / length };
  const midpoint = {
    x: (start.x + end.x) / 2 + normal.x * bend,
    y: (start.y + end.y) / 2 + normal.y * bend,
  };
  return `M ${start.x} ${start.y} Q ${midpoint.x} ${midpoint.y} ${end.x} ${end.y}`;
}

function addPoint(
  point: { x: number; y: number },
  delta: { x: number; y: number },
) {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

function roundPoint(point: { x: number; y: number }) {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
