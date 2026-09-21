import { useCallback, useEffect, useRef, useState } from "react";
import {
  ViewportPortal,
  useReactFlow,
  useStore,
  type Node,
} from "@xyflow/react";
import type {
  BoardPosition,
  CanvasArrowEndpoint,
  CanvasArrowHead,
  CanvasArrowObject,
  CanvasArrowRouting,
  CanvasArrowStyle,
  CanvasObjectColor,
} from "@/api/collection";
import {
  hasSelectionModifier,
  isSelectionShortcutBlocked,
} from "@/lib/selection";
import { cn } from "@/lib/utils";
import {
  arrowheadSketchJitter,
  arrowMarkerRefX,
  makeArrowPaths,
} from "./canvas-arrow-geometry";
import { arrowHasIdentity, arrowIsSelected } from "./canvas-arrow-identity";
import { createArrowPreviewSessionTracker } from "./canvas-arrow-preview-session";
import {
  ARROW_CORNER_RESIZE_HANDLES,
  arrowResizeCursor,
  arrowFrameCorners,
  arrowFrameResizeHandlePositions,
  arrowRotationHandlePosition,
  makeArrowTransformFrame,
  normalizeArrowRotation,
  paddedArrowFrameBounds,
  resizeArrowPoints,
  rotateArrowPoints,
  snapArrowRotation,
  type ArrowResizeHandle,
} from "./canvas-arrow-transform";
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
  | "rotation"
  | "color"
>;

type ArrowGeometry = Pick<
  CanvasArrowObject,
  "start" | "end" | "points" | "routing" | "rotation"
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
    | "rotation"
    | "color"
  >
>;

type ArrowDrag = {
  arrowId: string;
  kind: "body" | "start" | "end" | "bend" | "insert" | "resize" | "rotate";
  index?: number;
  handle?: ArrowResizeHandle;
};

const ARROW_RESIZE_HANDLE_OFFSET = 8;

export function CanvasArrowLayer({
  arrows,
  draft,
  selectedIds,
  focusedId,
  pointEditId,
  enabled,
  editable,
  onSelect,
  onFocus,
  onPointEditChange,
  onUpdate,
  onDelete,
}: {
  arrows: CanvasArrowObject[];
  draft?: DraftCanvasArrow;
  selectedIds: ReadonlySet<string>;
  focusedId?: string;
  pointEditId?: string;
  enabled: boolean;
  editable: boolean;
  onSelect: (id: string, event: React.MouseEvent) => void;
  onFocus: (id: string) => void;
  onPointEditChange: (id: string | undefined) => void;
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
  const [previews, setPreviews] = useState<Record<string, ArrowGeometry>>({});
  const [activeBend, setActiveBend] = useState<{
    arrowId: string;
    index: number;
  }>();
  const [dragging, setDragging] = useState<ArrowDrag>();
  const [previewSessions] = useState(createArrowPreviewSessionTracker);
  const pointerFocusIdRef = useRef<string | undefined>(undefined);

  const resolveEndpoint = useCallback(
    (endpoint: CanvasArrowEndpoint) => {
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
    },
    [getNode],
  );

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

  const clearPreview = (id: string, previewSession: number) => {
    if (!previewSessions.owns(id, previewSession)) return;
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
    if (part === "body" && hasSelectionModifier(event)) {
      event.preventDefault();
      event.stopPropagation();
      if (
        event.detail === 1 &&
        !(arrowHasIdentity(arrow, focusedId) && selectedIds.size === 1)
      ) {
        onSelect(arrow.id, event);
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSelect(arrow.id, event);
    if (
      !editable ||
      (part === "body" && arrowHasIdentity(arrow, pointEditId))
    ) {
      return;
    }
    const previewSession = previewSessions.begin(arrow.id);
    const releasePointer = capturePointer(event);
    setDragging({ arrowId: arrow.id, kind: part });
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
          rotation: initial.rotation,
        },
      }));
    };
    const up = (upEvent: PointerEvent) => {
      cleanup();
      if (!didMove) {
        clearPreview(arrow.id, previewSession);
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
        rotation: initial.rotation,
      };
      setPreviews((current) => ({ ...current, [arrow.id]: update }));
      onUpdate(arrow.id, update, {
        onSettled: () => clearPreview(arrow.id, previewSession),
      });
    };
    const cancel = () => {
      cleanup();
      clearPreview(arrow.id, previewSession);
    };
    const cleanup = () => {
      releasePointer();
      setDragging(undefined);
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
    if (
      !enabled ||
      !editable ||
      (insert &&
        !arrowHasIdentity(arrow, pointEditId) &&
        arrow.points.length > 0)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSelect(arrow.id, event);
    const previewSession = previewSessions.begin(arrow.id);
    const releasePointer = capturePointer(event);
    if (!insert && arrowHasIdentity(arrow, pointEditId)) {
      setActiveBend({ arrowId: arrow.id, index });
    }
    setDragging({
      arrowId: arrow.id,
      kind: insert ? "insert" : "bend",
      index,
    });
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
        clearPreview(arrow.id, previewSession);
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
        { onSettled: () => clearPreview(arrow.id, previewSession) },
      );
    };
    const cancel = () => {
      cleanup();
      clearPreview(arrow.id, previewSession);
    };
    const cleanup = () => {
      releasePointer();
      setDragging(undefined);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  };

  const beginResize = (
    event: React.PointerEvent,
    arrow: CanvasArrowObject,
    handle: ArrowResizeHandle,
  ) => {
    if (!enabled || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus(arrow.id);
    const previewSession = previewSessions.begin(arrow.id);
    const releasePointer = capturePointer(event);
    const initial = resolvedGeometry(arrow, resolveEndpoint);
    const initialPoints = geometryPoints(initial);
    const frame = makeArrowTransformFrame(initialPoints, initial.rotation);
    const pointerStart = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    let latest = initial;
    let didMove = false;
    setDragging({ arrowId: arrow.id, kind: "resize", handle });

    const move = (moveEvent: PointerEvent) => {
      const point = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      const delta = subtractPoint(point, pointerStart);
      didMove ||= Math.hypot(delta.x, delta.y) > 1 / zoom;
      const resized = resizeArrowPoints(initialPoints, frame, handle, delta, {
        preserveAspectRatio: moveEvent.shiftKey,
        fromCenter: moveEvent.altKey,
        minimumSize: 12 / zoom,
      });
      latest = geometryFromPoints(resized, arrow.routing, initial.rotation);
      setPreviews((current) => ({ ...current, [arrow.id]: latest }));
    };
    const up = () => {
      cleanup();
      if (!didMove) {
        clearPreview(arrow.id, previewSession);
        return;
      }
      const update = roundedGeometry(latest);
      setPreviews((current) => ({ ...current, [arrow.id]: update }));
      onUpdate(arrow.id, update, {
        onSettled: () => clearPreview(arrow.id, previewSession),
      });
    };
    const cancel = () => {
      cleanup();
      clearPreview(arrow.id, previewSession);
    };
    const cleanup = () => {
      releasePointer();
      setDragging(undefined);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  };

  const beginRotation = (
    event: React.PointerEvent,
    arrow: CanvasArrowObject,
  ) => {
    if (!enabled || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    onFocus(arrow.id);
    const previewSession = previewSessions.begin(arrow.id);
    const releasePointer = capturePointer(event);
    const initial = resolvedGeometry(arrow, resolveEndpoint);
    const initialPoints = geometryPoints(initial);
    const frame = makeArrowTransformFrame(initialPoints, initial.rotation);
    const pointerStart = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const startAngle = Math.atan2(
      pointerStart.y - frame.center.y,
      pointerStart.x - frame.center.x,
    );
    let latest = initial;
    let didMove = false;
    setDragging({ arrowId: arrow.id, kind: "rotate" });

    const move = (moveEvent: PointerEvent) => {
      const point = screenToFlowPosition({
        x: moveEvent.clientX,
        y: moveEvent.clientY,
      });
      let angle =
        Math.atan2(point.y - frame.center.y, point.x - frame.center.x) -
        startAngle;
      if (moveEvent.shiftKey) {
        angle = snapArrowRotation(initial.rotation + angle) - initial.rotation;
      }
      didMove ||= Math.abs(angle) > 0.002;
      latest = geometryFromPoints(
        rotateArrowPoints(initialPoints, frame.center, angle),
        arrow.routing,
        normalizeArrowRotation(initial.rotation + angle),
      );
      setPreviews((current) => ({ ...current, [arrow.id]: latest }));
    };
    const up = () => {
      cleanup();
      if (!didMove) {
        clearPreview(arrow.id, previewSession);
        return;
      }
      const update = roundedGeometry(latest);
      setPreviews((current) => ({ ...current, [arrow.id]: update }));
      onUpdate(arrow.id, update, {
        onSettled: () => clearPreview(arrow.id, previewSession),
      });
    };
    const cancel = () => {
      cleanup();
      clearPreview(arrow.id, previewSession);
    };
    const cleanup = () => {
      releasePointer();
      setDragging(undefined);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
  };

  useEffect(() => {
    const editedArrow = pointEditId
      ? arrows.find((arrow) => arrowHasIdentity(arrow, pointEditId))
      : undefined;
    if (
      pointEditId &&
      (!editedArrow || !arrowHasIdentity(editedArrow, focusedId) || !editable)
    ) {
      onPointEditChange(undefined);
      setActiveBend(undefined);
    }
  }, [arrows, editable, focusedId, onPointEditChange, pointEditId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!focusedId) return;
      if (isSelectionShortcutBlocked(event.target)) return;
      const arrow = arrows.find((candidate) =>
        arrowHasIdentity(candidate, focusedId),
      );
      if (!arrow || !arrowIsSelected(arrow, selectedIds)) return;
      const pointEditing = arrowHasIdentity(arrow, pointEditId);

      if (editable && hasSelectionModifier(event) && event.key === "Enter") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onPointEditChange(focusedId);
        setActiveBend(undefined);
        return;
      }
      if (event.key === "Delete") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (pointEditing) {
          if (!activeBend || !arrowHasIdentity(arrow, activeBend.arrowId)) {
            return;
          }
          const points = arrow.points.filter(
            (_point, index) => index !== activeBend.index,
          );
          onFocus(arrow.id);
          onPointEditChange(arrow.id);
          onUpdate(arrow.id, {
            points,
            ...(points.length === 0 ? { rotation: 0 } : {}),
          });
          setActiveBend(undefined);
          return;
        }
        onDelete(focusedId);
        return;
      }

      const direction = keyboardNudge(event);
      if (!editable || !direction || pointEditing) return;
      if (
        !(event.target instanceof Element) ||
        !event.target.closest(`[data-arrow-focus-id="${focusedId}"]`)
      ) {
        return;
      }
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const geometry = resolvedGeometry(arrow, resolveEndpoint);
      onUpdate(focusedId, {
        start: {
          position: addPoint(geometry.start.position, {
            x: direction.x * step,
            y: direction.y * step,
          }),
        },
        end: {
          position: addPoint(geometry.end.position, {
            x: direction.x * step,
            y: direction.y * step,
          }),
        },
        points: geometry.points.map((point) =>
          addPoint(point, {
            x: direction.x * step,
            y: direction.y * step,
          }),
        ),
      });
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [
    activeBend,
    arrows,
    editable,
    focusedId,
    onDelete,
    onPointEditChange,
    onUpdate,
    pointEditId,
    resolveEndpoint,
    selectedIds,
  ]);

  const nudgeEndpoint = (
    event: React.KeyboardEvent<SVGGElement>,
    arrow: CanvasArrowObject,
    part: "start" | "end",
  ) => {
    const direction = keyboardNudge(event);
    if (!direction || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    const geometry = resolvedGeometry(arrow, resolveEndpoint);
    const step = event.shiftKey ? 10 : 1;
    onUpdate(arrow.id, {
      [part]: {
        position: addPoint(geometry[part].position, {
          x: direction.x * step,
          y: direction.y * step,
        }),
      },
    });
  };

  const nudgeBend = (
    event: React.KeyboardEvent<SVGGElement>,
    arrow: CanvasArrowObject,
    index: number,
  ) => {
    const direction = keyboardNudge(event);
    if (!direction || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const rotation = arrow.rotation ?? 0;
    onUpdate(arrow.id, {
      points: arrow.points.map((point, pointIndex) =>
        pointIndex === index
          ? addPoint(point, {
              x: direction.x * step,
              y: direction.y * step,
            })
          : point,
      ),
      rotation,
    });
  };

  const insertBendFromKeyboard = (
    event: React.KeyboardEvent<SVGGElement>,
    arrow: CanvasArrowObject,
    index: number,
    position: BoardPosition,
  ) => {
    if (event.key !== "Enter" || !editable || arrow.points.length >= 16) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rotation = arrow.rotation ?? 0;
    onUpdate(arrow.id, {
      points: insertPoint(arrow.points, index, roundPoint(position)),
      rotation,
    });
    setActiveBend({ arrowId: arrow.id, index });
  };

  const resizeFromKeyboard = (
    event: React.KeyboardEvent<SVGGElement>,
    arrow: CanvasArrowObject,
    handle: ArrowResizeHandle,
  ) => {
    const direction = keyboardNudge(event);
    if (!direction || !editable) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const geometry = resolvedGeometry(arrow, resolveEndpoint);
    const points = geometryPoints(geometry);
    const resized = resizeArrowPoints(
      points,
      makeArrowTransformFrame(points, geometry.rotation),
      handle,
      { x: direction.x * step, y: direction.y * step },
      {
        preserveAspectRatio: event.shiftKey,
        fromCenter: event.altKey,
        minimumSize: 12 / zoom,
      },
    );
    onUpdate(
      arrow.id,
      roundedGeometry(
        geometryFromPoints(resized, arrow.routing, geometry.rotation),
      ),
    );
  };

  const rotateFromKeyboard = (
    event: React.KeyboardEvent<SVGGElement>,
    arrow: CanvasArrowObject,
  ) => {
    if (
      !editable ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const geometry = resolvedGeometry(arrow, resolveEndpoint);
    const points = geometryPoints(geometry);
    const delta =
      (event.key === "ArrowLeft" ? -1 : 1) *
      (event.shiftKey ? Math.PI / 12 : Math.PI / 180);
    const rotation = normalizeArrowRotation(geometry.rotation + delta);
    onUpdate(
      arrow.id,
      roundedGeometry(
        geometryFromPoints(
          rotateArrowPoints(
            points,
            makeArrowTransformFrame(points, geometry.rotation).center,
            delta,
          ),
          arrow.routing,
          rotation,
        ),
      ),
    );
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
            const transientId =
              arrow.clientId &&
              (previews[arrow.clientId] || dragging?.arrowId === arrow.clientId)
                ? arrow.clientId
                : arrow.id;
            const preview = previews[transientId];
            const geometry = preview
              ? resolvedGeometry({ ...arrow, ...preview }, resolveEndpoint)
              : resolvedGeometry(arrow, resolveEndpoint);
            const points = geometryPoints(geometry);
            const selected = arrowIsSelected(arrow, selectedIds);
            const focused = selected && arrowHasIdentity(arrow, focusedId);
            const mode = arrowHasIdentity(arrow, pointEditId)
              ? "point-edit"
              : "transform";
            const hasBends = geometry.points.length > 0;
            const activeDrag =
              dragging?.arrowId === transientId ? dragging : undefined;
            const keepsFullTransformUi =
              activeDrag?.kind === "body" ||
              activeDrag?.kind === "resize" ||
              activeDrag?.kind === "rotate";
            const isPathHandleDrag =
              activeDrag?.kind === "start" ||
              activeDrag?.kind === "end" ||
              activeDrag?.kind === "bend" ||
              activeDrag?.kind === "insert";
            const showTransformFrame =
              focused &&
              editable &&
              hasBends &&
              mode === "transform" &&
              (!activeDrag || keepsFullTransformUi);
            const showFrameControls = showTransformFrame;
            const showPathControls =
              focused &&
              editable &&
              (!activeDrag || keepsFullTransformUi || isPathHandleDrag);
            const showFrameMoveSurface =
              focused &&
              editable &&
              hasBends &&
              mode === "transform" &&
              (!activeDrag || activeDrag.kind === "body");
            const showSelectionRing = selected && (!focused || !editable);
            const paths = makeArrowPaths(
              arrow.id,
              points,
              arrow.style,
              geometry.routing,
            );
            const endpointHandles = endpointHandlePositions(points, zoom);
            const frame = makeArrowTransformFrame(points, geometry.rotation);
            const frameBounds = paddedArrowFrameBounds(
              frame,
              8 / zoom,
              11 / zoom,
            );
            const frameCorners = arrowFrameCorners(frame, frameBounds);
            const frameHandles = arrowFrameResizeHandlePositions(
              frame,
              frameBounds,
              ARROW_RESIZE_HANDLE_OFFSET / zoom,
            );
            const rotationHandle = arrowRotationHandlePosition(
              frame,
              frameBounds,
              24 / zoom,
            );
            return (
              <g key={arrow.clientId ?? arrow.id} className="group/arrow">
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
                {arrow.id !== "arrow-draft" &&
                (showTransformFrame || showSelectionRing) ? (
                  <polygon
                    points={frameCorners
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={showSelectionRing ? "2" : "1.5"}
                    vectorEffect="non-scaling-stroke"
                    className={cn(
                      "pointer-events-none transition-opacity duration-100 ease-out motion-reduce:transition-none",
                      showSelectionRing ? "opacity-100" : "opacity-90",
                    )}
                  />
                ) : null}
                {showFrameMoveSurface ? (
                  <polygon
                    points={frameCorners
                      .map((point) => `${point.x},${point.y}`)
                      .join(" ")}
                    fill="transparent"
                    stroke="none"
                    className="pointer-events-auto cursor-move"
                    onPointerDown={(event) => beginDrag(event, arrow, "body")}
                    onClick={(event) => event.stopPropagation()}
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
                    className={cn(
                      "pointer-events-auto outline-none",
                      enabled &&
                        (mode === "point-edit"
                          ? "cursor-default"
                          : editable
                            ? "cursor-move"
                            : "cursor-pointer"),
                    )}
                    data-selection-node-id={arrow.id}
                    data-arrow-focus-id={arrow.id}
                    tabIndex={enabled ? 0 : undefined}
                    role="button"
                    aria-label={`Arrow${mode === "point-edit" ? ", editing points" : ""}`}
                    onFocus={() => {
                      if (pointerFocusIdRef.current !== arrow.id) {
                        onFocus(arrow.id);
                      }
                      pointerFocusIdRef.current = undefined;
                    }}
                    onPointerDown={(event) => {
                      pointerFocusIdRef.current = arrow.id;
                      requestAnimationFrame(() => {
                        if (pointerFocusIdRef.current === arrow.id) {
                          pointerFocusIdRef.current = undefined;
                        }
                      });
                      beginDrag(event, arrow, "body");
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      if (!editable || !hasSelectionModifier(event)) {
                        return;
                      }
                      event.preventDefault();
                      onFocus(arrow.id);
                      onPointEditChange(arrow.id);
                      setActiveBend(undefined);
                    }}
                  />
                ) : null}
                {showFrameControls ? (
                  <>
                    <line
                      x1={rotationHandle.connector.x}
                      y1={rotationHandle.connector.y}
                      x2={rotationHandle.handle.x}
                      y2={rotationHandle.handle.y}
                      stroke="var(--primary)"
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                      className="pointer-events-none opacity-70"
                    />
                    {ARROW_CORNER_RESIZE_HANDLES.map((handle) => (
                      <ArrowResizeHandleControl
                        key={handle}
                        handle={handle}
                        position={frameHandles[handle]}
                        angle={frame.angle}
                        zoom={zoom}
                        onPointerDown={(event) =>
                          beginResize(event, arrow, handle)
                        }
                        onKeyDown={(event) =>
                          resizeFromKeyboard(event, arrow, handle)
                        }
                      />
                    ))}
                    <ArrowRotationHandle
                      position={rotationHandle.handle}
                      zoom={zoom}
                      onPointerDown={(event) => beginRotation(event, arrow)}
                      onKeyDown={(event) => rotateFromKeyboard(event, arrow)}
                    />
                  </>
                ) : null}
                {showPathControls ? (
                  <>
                    <ArrowCircleHandle
                      position={endpointHandles.start}
                      zoom={zoom}
                      color={arrow.color}
                      label="Move arrow start"
                      onPointerDown={(event) =>
                        beginDrag(event, arrow, "start")
                      }
                      onKeyDown={(event) =>
                        nudgeEndpoint(event, arrow, "start")
                      }
                    />
                    <ArrowCircleHandle
                      position={endpointHandles.end}
                      zoom={zoom}
                      color={arrow.color}
                      label="Move arrow end"
                      onPointerDown={(event) => beginDrag(event, arrow, "end")}
                      onKeyDown={(event) => nudgeEndpoint(event, arrow, "end")}
                    />
                    {!hasBends && mode === "transform" ? (
                      <ArrowCircleHandle
                        position={midpoint(
                          geometry.start.position,
                          geometry.end.position,
                        )}
                        zoom={zoom}
                        color={arrow.color}
                        label="Bend arrow"
                        onPointerDown={(event) =>
                          beginBendDrag(
                            event,
                            arrow,
                            0,
                            true,
                            midpoint(
                              geometry.start.position,
                              geometry.end.position,
                            ),
                          )
                        }
                      />
                    ) : null}
                    {geometry.points.map((point, index) => (
                      <ArrowCircleHandle
                        key={`point-${index}`}
                        position={point}
                        zoom={zoom}
                        color={arrow.color}
                        label={`Move bend ${index + 1}`}
                        active={
                          mode === "point-edit" &&
                          arrowHasIdentity(arrow, activeBend?.arrowId) &&
                          activeBend?.index === index
                        }
                        onFocus={() => {
                          if (mode === "point-edit") {
                            setActiveBend({ arrowId: arrow.id, index });
                          }
                        }}
                        onPointerDown={(event) => {
                          if (
                            mode === "point-edit" &&
                            hasSelectionModifier(event)
                          ) {
                            event.preventDefault();
                            event.stopPropagation();
                            event.currentTarget.blur();
                            const remainingPoints = geometry.points.filter(
                              (_point, pointIndex) => pointIndex !== index,
                            );
                            onFocus(arrow.id);
                            onPointEditChange(arrow.id);
                            onUpdate(arrow.id, {
                              points: remainingPoints,
                              ...(remainingPoints.length === 0
                                ? { rotation: 0 }
                                : {}),
                            });
                            setActiveBend(undefined);
                            return;
                          }
                          beginBendDrag(event, arrow, index, false);
                        }}
                        onKeyDown={(event) => nudgeBend(event, arrow, index)}
                      />
                    ))}
                    {mode === "point-edit" && geometry.points.length < 16
                      ? paths.segmentAnchors.map((point, index) => (
                          <ArrowDiamondHandle
                            key={`insert-${index}`}
                            position={point}
                            zoom={zoom}
                            color={arrow.color}
                            label={`Add bend after point ${index + 1}`}
                            onPointerDown={(event) =>
                              beginBendDrag(event, arrow, index, true, point)
                            }
                            onKeyDown={(event) =>
                              insertBendFromKeyboard(event, arrow, index, point)
                            }
                          />
                        ))
                      : null}
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>
      </ViewportPortal>
    </>
  );
}

function ArrowCircleHandle({
  position,
  zoom,
  color,
  label,
  active = false,
  onFocus,
  onPointerDown,
  onKeyDown,
}: {
  position: BoardPosition;
  zoom: number;
  color: CanvasObjectColor;
  label: string;
  active?: boolean;
  onFocus?: () => void;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<SVGGElement>) => void;
}) {
  return (
    <g
      className="group/arrow-handle pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
      data-arrow-control
      role="button"
      aria-label={label}
      tabIndex={0}
      onFocus={onFocus}
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        if (hasSelectionModifier(event)) event.preventDefault();
      }}
      onKeyDown={onKeyDown}
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
        className={cn(
          "pointer-events-none transition-[fill,stroke-width] duration-100 ease-out group-hover/arrow-handle:fill-accent group-hover/arrow-handle:stroke-[2.75px] group-focus-visible/arrow-handle:fill-accent group-focus-visible/arrow-handle:stroke-[2.75px]",
          active && "fill-accent stroke-[2.75px]",
        )}
      />
    </g>
  );
}

function ArrowDiamondHandle({
  position,
  zoom,
  color,
  label,
  onPointerDown,
  onKeyDown,
}: {
  position: BoardPosition;
  zoom: number;
  color: CanvasObjectColor;
  label: string;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<SVGGElement>) => void;
}) {
  const size = 6.5 / zoom;
  const hoverSize = 9 / zoom;
  return (
    <g
      className="group/arrow-handle pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
      data-arrow-control
      role="button"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
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
          className="pointer-events-none transition-[fill,stroke-width] duration-100 ease-out group-hover/arrow-handle:fill-accent group-hover/arrow-handle:stroke-[2.25px] group-focus-visible/arrow-handle:fill-accent group-focus-visible/arrow-handle:stroke-[2.25px]"
        />
      </g>
    </g>
  );
}

function ArrowResizeHandleControl({
  handle,
  position,
  angle,
  zoom,
  onPointerDown,
  onKeyDown,
}: {
  handle: ArrowResizeHandle;
  position: BoardPosition;
  angle: number;
  zoom: number;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<SVGGElement>) => void;
}) {
  const visibleSize = 7 / zoom;
  return (
    <g
      className={cn(
        "group/resize-handle pointer-events-auto",
        arrowResizeCursor(handle, angle),
      )}
      style={{ touchAction: "none" }}
      data-arrow-control
      role="button"
      aria-label={`Resize arrow from ${handle}`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <circle
        cx={position.x}
        cy={position.y}
        r={12 / zoom}
        fill="transparent"
      />
      <rect
        x={position.x - visibleSize / 2}
        y={position.y - visibleSize / 2}
        width={visibleSize}
        height={visibleSize}
        rx={1.5 / zoom}
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        transform={`rotate(${(angle * 180) / Math.PI} ${position.x} ${position.y})`}
        className="pointer-events-none transition-[fill,stroke-width] duration-100 ease-out group-hover/resize-handle:fill-primary/10 group-hover/resize-handle:stroke-[2px] group-focus-visible/resize-handle:fill-primary/10 group-focus-visible/resize-handle:stroke-[2px]"
      />
    </g>
  );
}

function ArrowRotationHandle({
  position,
  zoom,
  onPointerDown,
  onKeyDown,
}: {
  position: BoardPosition;
  zoom: number;
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<SVGGElement>) => void;
}) {
  return (
    <g
      className="group/rotation-handle pointer-events-auto cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
      data-arrow-control
      role="button"
      aria-label="Rotate arrow"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <circle
        cx={position.x}
        cy={position.y}
        r={12 / zoom}
        fill="transparent"
      />
      <circle
        cx={position.x}
        cy={position.y}
        r={5 / zoom}
        fill="var(--background)"
        stroke="var(--primary)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        className="pointer-events-none transition-[fill,stroke-width] duration-100 ease-out group-hover/rotation-handle:fill-primary/10 group-hover/rotation-handle:stroke-[2px] group-focus-visible/rotation-handle:fill-primary/10 group-focus-visible/rotation-handle:stroke-[2px]"
      />
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

export { makeArrowPath } from "./canvas-arrow-geometry";

function capturePointer(event: React.PointerEvent) {
  const target = event.currentTarget;
  const pointerId = event.pointerId;
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // The browser can release capture when a pointer ends before cleanup runs.
  }
  return () => {
    try {
      if (target.hasPointerCapture(pointerId)) {
        target.releasePointerCapture(pointerId);
      }
    } catch {
      // The target can be detached while the interaction is being cleaned up.
    }
  };
}

function resolvedGeometry(
  arrow: Pick<
    CanvasArrowObject,
    "start" | "end" | "points" | "routing" | "rotation"
  >,
  resolveEndpoint: (endpoint: CanvasArrowEndpoint) => BoardPosition,
): ArrowGeometry {
  return {
    start: { position: resolveEndpoint(arrow.start) },
    end: { position: resolveEndpoint(arrow.end) },
    points: arrow.points,
    routing: arrow.routing,
    rotation: arrow.rotation ?? 0,
  };
}
function geometryPoints(geometry: ArrowGeometry) {
  return [geometry.start.position, ...geometry.points, geometry.end.position];
}
function midpointForSegment(geometry: ArrowGeometry, index: number) {
  const points = geometryPoints(geometry);
  return midpoint(points[index]!, points[index + 1]!);
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
function subtractPoint(point: BoardPosition, origin: BoardPosition) {
  return { x: point.x - origin.x, y: point.y - origin.y };
}
function geometryFromPoints(
  points: readonly BoardPosition[],
  routing: CanvasArrowRouting,
  rotation: number,
): ArrowGeometry {
  return {
    start: { position: points[0]! },
    end: { position: points.at(-1)! },
    points: points.slice(1, -1),
    routing,
    rotation,
  };
}
function roundedGeometry(geometry: ArrowGeometry): ArrowGeometry {
  return {
    start: { position: roundPoint(geometry.start.position) },
    end: { position: roundPoint(geometry.end.position) },
    points: geometry.points.map(roundPoint),
    routing: geometry.routing,
    rotation: normalizeArrowRotation(geometry.rotation),
  };
}
function roundPoint(point: BoardPosition): BoardPosition {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}
function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
function keyboardNudge(event: { key: string }): BoardPosition | undefined {
  if (event.key === "ArrowLeft") return { x: -1, y: 0 };
  if (event.key === "ArrowRight") return { x: 1, y: 0 };
  if (event.key === "ArrowUp") return { x: 0, y: -1 };
  if (event.key === "ArrowDown") return { x: 0, y: 1 };
  return undefined;
}
