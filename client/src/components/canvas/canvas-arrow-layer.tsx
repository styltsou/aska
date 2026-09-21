import { useState } from "react";
import {
  ViewportPortal,
  useReactFlow,
  useStore,
  type Node,
} from "@xyflow/react";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { AnimatePresence } from "motion/react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GLASS_OPTION_TOOLBAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useTransientStore } from "@/store";
import { CanvasColorSwatches } from "./canvas-color-swatches";
import { CanvasScreenOverlay } from "./canvas-screen-overlay";
import {
  arrowheadSketchJitter,
  arrowMarkerRefX,
  makeArrowPaths,
} from "./canvas-arrow-geometry";
import {
  CANVAS_OBJECT_COLORS,
  arrowDashArray,
  canvasObjectColor,
} from "./canvas-object-style";
import { ARROW_Z_INDEX } from "./canvas-node-stacking";

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
  boardKey,
  selectedIds,
  focusedId,
  enabled,
  onSelect,
  onUpdate,
  onDelete,
}: {
  arrows: CanvasArrowObject[];
  draft?: DraftCanvasArrow;
  boardKey: string;
  selectedIds: ReadonlySet<string>;
  focusedId?: string;
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
  const zoom = useStore((state) => state.transform[2]);
  const viewportActivity = useTransientStore(
    (state) => state.canvasViewportActivity[boardKey] ?? 0,
  );
  const [previews, setPreviews] = useState<Record<string, ArrowGeometry>>({});

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
    insertionPoint?: BoardPosition,
  ) => {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(arrow.id, event);
    const geometry = resolvedGeometry(arrow, resolveEndpoint);
    const initialPoints = insert
      ? insertPoint(
          geometry.points,
          index,
          insertionPoint ?? midpointForSegment(geometry, index),
        )
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
      latestPoints = initialPoints.map((bend, bendIndex) => {
        if (bendIndex !== index) return bend;
        return insert ? point : addPoint(bend, delta);
      });
      setPreviews((current) => ({
        ...current,
        [arrow.id]: {
          ...geometry,
          points: latestPoints,
          routing: geometry.routing,
        },
      }));
    };
    const up = () => {
      cleanup();
      if (!didMove) {
        clearPreview(arrow.id);
        return;
      }
      const points = latestPoints.map(roundPoint);
      setPreviews((current) => ({
        ...current,
        [arrow.id]: { ...geometry, points, routing: geometry.routing },
      }));
      onUpdate(
        arrow.id,
        { points, routing: geometry.routing },
        { onSettled: () => clearPreview(arrow.id) },
      );
    };
    const cancel = () => {
      cleanup();
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
    <>
      <ViewportPortal>
        <svg
          className="pointer-events-none absolute top-0 left-0 overflow-visible"
          style={{ zIndex: ARROW_Z_INDEX }}
          width="1"
          height="1"
          aria-label="Canvas arrows"
        >
          <defs>
            {CANVAS_OBJECT_COLORS.flatMap((color) =>
              (["filled", "hollow", "chevron"] as CanvasArrowHead[]).map(
                (head) => (
                  <ArrowMarker
                    key={`${color}-${head}-clean`}
                    color={color}
                    head={head}
                    style="clean"
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
            const focused = focusedId === arrow.id && selected;
            const paths = makeArrowPaths(
              arrow.id,
              points,
              arrow.style,
              geometry.routing,
            );
            const endpointHandles = endpointHandlePositions(points, zoom);
            return (
              <g key={arrow.id}>
                {arrow.style === "sketch" ? (
                  <defs>
                    <ArrowMarker
                      color={arrow.color}
                      head={arrow.head}
                      style="sketch"
                      seed={arrow.id}
                    />
                  </defs>
                ) : null}
                {selected ? (
                  <path
                    d={paths.primary}
                    fill="none"
                    stroke="var(--background)"
                    strokeWidth="6"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                {paths.secondary ? (
                  <path
                    d={paths.secondary}
                    fill="none"
                    stroke={canvasObjectColor(arrow.color)}
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={arrowDashArray(arrow.pattern)}
                    opacity={arrow.pattern === "solid" ? 0.65 : 0.42}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                <path
                  d={paths.primary}
                  fill="none"
                  stroke={canvasObjectColor(arrow.color)}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={arrowDashArray(arrow.pattern)}
                  vectorEffect="non-scaling-stroke"
                  markerEnd={`url(#aska-arrowhead-${arrow.color}-${arrow.head}-${arrow.style}${arrow.style === "sketch" ? `-${arrow.id}` : ""})`}
                />
                {arrow.id !== "arrow-draft" ? (
                  <path
                    d={paths.canonical}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-auto cursor-move"
                    data-selection-node-id={arrow.id}
                    onPointerDown={(event) => beginDrag(event, arrow, "body")}
                  />
                ) : null}
                {focused ? (
                  <>
                    <ArrowCircleHandle
                      position={endpointHandles.start}
                      zoom={zoom}
                      color={arrow.color}
                      onPointerDown={(event) =>
                        beginDrag(event, arrow, "start")
                      }
                    />
                    <ArrowCircleHandle
                      position={endpointHandles.end}
                      zoom={zoom}
                      color={arrow.color}
                      onPointerDown={(event) => beginDrag(event, arrow, "end")}
                    />
                    {geometry.points.map((point, index) => (
                      <ArrowCircleHandle
                        key={`point-${index}`}
                        position={point}
                        zoom={zoom}
                        color={arrow.color}
                        onPointerDown={(event) =>
                          beginBendDrag(event, arrow, index, false)
                        }
                      />
                    ))}
                    {paths.segmentAnchors.map((point, index) => (
                      <ArrowDiamondHandle
                        key={`insert-${index}`}
                        position={point}
                        zoom={zoom}
                        color={arrow.color}
                        onPointerDown={(event) =>
                          beginBendDrag(event, arrow, index, true, point)
                        }
                      />
                    ))}
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>
      </ViewportPortal>
      <AnimatePresence initial={false}>
        {arrows.map((arrow) => {
          if (focusedId !== arrow.id || !selectedIds.has(arrow.id)) return null;
          const preview = previews[arrow.id];
          const geometry = preview
            ? resolvedGeometry({ ...arrow, ...preview }, resolveEndpoint)
            : resolvedGeometry(arrow, resolveEndpoint);
          return (
            <ArrowToolbar
              key={`${arrow.id}-toolbar`}
              arrow={preview ? { ...arrow, ...preview } : arrow}
              position={toolbarPosition(geometry)}
              dismissKey={viewportActivity}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          );
        })}
      </AnimatePresence>
    </>
  );
}

function ArrowCircleHandle({
  position,
  zoom,
  color,
  onPointerDown,
}: {
  position: BoardPosition;
  zoom: number;
  color: CanvasObjectColor;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  return (
    <g
      className="group/arrow-handle pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
    >
      <circle
        cx={position.x}
        cy={position.y}
        r={10 / zoom}
        fill="transparent"
      />
      <g className="pointer-events-none origin-center scale-[0.78] opacity-0 transition-[transform,opacity] duration-150 ease-out [transform-box:fill-box] group-hover/arrow-handle:scale-100 group-hover/arrow-handle:opacity-[0.14] motion-reduce:scale-100 motion-reduce:transition-none">
        <circle
          cx={position.x}
          cy={position.y}
          r={7 / zoom}
          fill={canvasObjectColor(color)}
        />
      </g>
      <circle
        cx={position.x}
        cy={position.y}
        r={5 / zoom}
        fill="var(--background)"
        stroke={canvasObjectColor(color)}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        className="pointer-events-none transition-[fill,stroke-width] duration-100 ease-out group-hover/arrow-handle:fill-accent group-hover/arrow-handle:stroke-[2.75px]"
      />
    </g>
  );
}

function ArrowDiamondHandle({
  position,
  zoom,
  color,
  onPointerDown,
}: {
  position: BoardPosition;
  zoom: number;
  color: CanvasObjectColor;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
}) {
  const size = 6.5 / zoom;
  const hoverSize = 9 / zoom;
  return (
    <g
      className="group/arrow-handle pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
    >
      <circle cx={position.x} cy={position.y} r={9 / zoom} fill="transparent" />
      <g transform={`rotate(45 ${position.x} ${position.y})`}>
        <g className="pointer-events-none origin-center scale-[0.78] opacity-0 transition-[transform,opacity] duration-150 ease-out [transform-box:fill-box] group-hover/arrow-handle:scale-100 group-hover/arrow-handle:opacity-[0.14] motion-reduce:scale-100 motion-reduce:transition-none">
          <rect
            x={position.x - hoverSize / 2}
            y={position.y - hoverSize / 2}
            width={hoverSize}
            height={hoverSize}
            rx={1.25 / zoom}
            fill={canvasObjectColor(color)}
          />
        </g>
        <rect
          x={position.x - size / 2}
          y={position.y - size / 2}
          width={size}
          height={size}
          rx={1 / zoom}
          fill="var(--background)"
          stroke={canvasObjectColor(color)}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          className="pointer-events-none transition-[fill,stroke-width] duration-100 ease-out group-hover/arrow-handle:fill-accent group-hover/arrow-handle:stroke-[2.25px]"
        />
      </g>
    </g>
  );
}

function ArrowMarker({
  color,
  head,
  style,
  seed,
}: {
  color: CanvasObjectColor;
  head: CanvasArrowHead;
  style: CanvasArrowStyle;
  seed?: string;
}) {
  const stroke = canvasObjectColor(color);
  const markerPath = (pass: "primary" | "secondary") => {
    const skew =
      style === "sketch"
        ? arrowheadSketchJitter(seed ?? "", pass)
        : { tipY: 0, leftX: 0, leftY: 0, rightX: 0, rightY: 0 };
    const inset = head === "filled" ? 0 : 0.75;
    const left = { x: inset + skew.leftX, y: inset + skew.leftY };
    const right = {
      x: inset + skew.rightX,
      y: 8 - inset + skew.rightY,
    };
    return `M ${left.x} ${left.y} L 8 ${4 + skew.tipY} L ${right.x} ${right.y}`;
  };
  const primaryPath = markerPath("primary");
  const secondaryPath = markerPath("secondary");
  return (
    <marker
      id={`aska-arrowhead-${color}-${head}-${style}${style === "sketch" && seed ? `-${seed}` : ""}`}
      markerWidth="9"
      markerHeight="9"
      refX={arrowMarkerRefX(style, head)}
      refY="4"
      orient="auto"
      markerUnits="strokeWidth"
      overflow="visible"
    >
      {head === "filled" ? (
        <>
          <path d={`${primaryPath} z`} fill={stroke} />
          {style === "sketch" ? (
            <path
              d={`${secondaryPath} z`}
              fill="none"
              stroke={stroke}
              strokeWidth="0.65"
              strokeLinejoin="round"
              opacity="0.65"
            />
          ) : null}
        </>
      ) : head === "hollow" ? (
        <>
          <path
            d={`${primaryPath} z`}
            fill="var(--background)"
            stroke={stroke}
            strokeWidth="1"
            strokeLinejoin="round"
          />
          {style === "sketch" ? (
            <path
              d={`${secondaryPath} z`}
              fill="none"
              stroke={stroke}
              strokeWidth="0.7"
              strokeLinejoin="round"
              opacity="0.65"
            />
          ) : null}
        </>
      ) : (
        <>
          <path
            d={primaryPath}
            fill="none"
            stroke={stroke}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {style === "sketch" ? (
            <path
              d={secondaryPath}
              fill="none"
              stroke={stroke}
              strokeWidth="0.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.65"
            />
          ) : null}
        </>
      )}
    </marker>
  );
}

function ArrowToolbar({
  arrow,
  position,
  dismissKey,
  onUpdate,
  onDelete,
}: {
  arrow: CanvasArrowObject;
  position: BoardPosition;
  dismissKey: number;
  onUpdate: (id: string, update: ArrowUpdate) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <CanvasScreenOverlay anchor={position} align="center" offset={18}>
      <div
        role="toolbar"
        aria-label="Arrow style"
        className="flex items-center gap-2"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            "flex items-center gap-0.5 rounded-lg px-1.5 py-1",
            GLASS_OPTION_TOOLBAR_CLASS,
          )}
        >
          <DropdownMenu key={`pattern-${dismissKey}`}>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-xs capitalize transition-colors hover:bg-foreground/5 data-popup-open:bg-foreground/10"
                />
              }
              aria-label="Arrow line type"
            >
              {arrow.pattern}
              <ChevronDownIcon className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="min-w-28"
            >
              <DropdownMenuRadioGroup
                value={arrow.pattern}
                onValueChange={(value) =>
                  onUpdate(arrow.id, { pattern: value as CanvasArrowPattern })
                }
              >
                {(["solid", "dashed", "dotted"] as CanvasArrowPattern[]).map(
                  (pattern) => (
                    <DropdownMenuRadioItem
                      key={pattern}
                      value={pattern}
                      className="capitalize"
                    >
                      {pattern}
                    </DropdownMenuRadioItem>
                  ),
                )}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarDivider />
          {(["clean", "sketch"] as CanvasArrowStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              className={cn(
                "h-7 cursor-pointer rounded-md px-2 text-xs capitalize hover:bg-foreground/5",
                arrow.style === style && "bg-foreground/10",
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
                "h-7 cursor-pointer rounded-md px-2 text-xs hover:bg-foreground/5",
                arrow.routing === routing && "bg-foreground/10",
              )}
              aria-label={`${routing} arrow path`}
              aria-pressed={arrow.routing === routing}
              onClick={() => onUpdate(arrow.id, { routing })}
            >
              {routing === "straight" ? "Line" : "Curve"}
            </button>
          ))}
          <ToolbarDivider />
          <DropdownMenu key={`head-${dismissKey}`}>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-foreground/5 data-popup-open:bg-foreground/10"
                />
              }
              aria-label={`${arrow.head} arrowhead`}
            >
              <ArrowheadGlyph head={arrow.head} style={arrow.style} />
              <ChevronDownIcon className="size-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="start"
              sideOffset={8}
              className="min-w-36"
            >
              <DropdownMenuRadioGroup
                value={arrow.head}
                onValueChange={(value) =>
                  onUpdate(arrow.id, { head: value as CanvasArrowHead })
                }
              >
                {(["filled", "hollow", "chevron"] as CanvasArrowHead[]).map(
                  (head) => (
                    <DropdownMenuRadioItem
                      key={head}
                      value={head}
                      className="capitalize"
                    >
                      <ArrowheadGlyph head={head} style={arrow.style} />
                      {head}
                    </DropdownMenuRadioItem>
                  ),
                )}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarDivider />
          <CanvasColorSwatches
            value={arrow.color}
            onChange={(color) => onUpdate(arrow.id, { color })}
            ariaLabel="Arrow color"
            dismissKey={dismissKey}
          />
        </div>
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg p-1",
            GLASS_OPTION_TOOLBAR_CLASS,
          )}
        >
          <button
            type="button"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete arrow"
            onClick={() => onDelete(arrow.id)}
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      </div>
    </CanvasScreenOverlay>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

function ArrowheadGlyph({
  head,
  style,
}: {
  head: CanvasArrowHead;
  style: CanvasArrowStyle;
}) {
  if (style === "sketch") {
    return (
      <svg viewBox="0 0 30 18" className="h-4 w-7" aria-hidden="true">
        <path
          d="M 1.5 9.4 Q 10 7.4 21 8.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M 2 8.1 Q 11 10.1 21.3 8.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />
        {head === "filled" ? (
          <>
            <path d="M 20.2 2.1 L 29 8.6 L 19.4 15.4 z" fill="currentColor" />
            <path
              d="M 20.7 2.7 L 28.7 8.1 L 19.8 14.8 z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.9"
              strokeLinejoin="round"
              opacity="0.65"
            />
          </>
        ) : head === "hollow" ? (
          <>
            <path
              d="M 20.2 2.1 L 29 8.6 L 19.4 15.4 z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M 20.7 2.7 L 28.7 8.1 L 19.8 14.8 z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeLinejoin="round"
              opacity="0.6"
            />
          </>
        ) : (
          <>
            <path
              d="M 20.2 2.1 L 29 8.6 L 19.4 15.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 20.7 2.7 L 28.7 8.1 L 19.8 14.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.85"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
          </>
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 30 18" className="h-4 w-7" aria-hidden="true">
      <path
        d="M 1.5 9 H 21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {head === "filled" ? (
        <path d="M 20 2 L 29 9 L 20 16 z" fill="currentColor" />
      ) : head === "hollow" ? (
        <path
          d="M 20 2 L 29 9 L 20 16 z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M 20 2 L 29 9 L 20 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export { makeArrowPath } from "./canvas-arrow-geometry";

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
  const distance = 8 / zoom;
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
