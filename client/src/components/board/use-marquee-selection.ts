import "@/components/selection/selection-marquee.css";

import { useCallback, useRef, useState } from "react";

import {
  hasSelectionModifier,
  rectFullyContains,
  type Rect,
} from "@/lib/selection";

export const selectionMarqueeClassName =
  "pointer-events-none fixed z-50 rounded-md border-0 bg-[color-mix(in_oklch,var(--primary)_9%,transparent)] [--marquee-dash-color:color-mix(in_oklch,var(--primary)_78%,transparent)] [background-image:linear-gradient(90deg,var(--marquee-dash-color)_0_60%,transparent_60%_100%),linear-gradient(0deg,var(--marquee-dash-color)_0_60%,transparent_60%_100%),linear-gradient(90deg,var(--marquee-dash-color)_0_60%,transparent_60%_100%),linear-gradient(0deg,var(--marquee-dash-color)_0_60%,transparent_60%_100%)] [background-position:0_0,100%_0,0_100%,0_0] [background-repeat:repeat-x,repeat-y,repeat-x,repeat-y] [background-size:20px_1px,1px_20px,20px_1px,1px_20px] animate-[selection-marquee-dashes_700ms_linear_infinite]";

const MOVEMENT_THRESHOLD = 4;

type Point = { x: number; y: number };

function normalizeRect(start: Point, end: Point): Rect {
  return {
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y),
  };
}

export function useMarqueeSelection({
  surfaceRef,
  eligibleNodeIds,
  onReplace,
  shouldStart,
  stopNativeEvents = false,
}: {
  surfaceRef: React.RefObject<HTMLElement | null>;
  eligibleNodeIds: ReadonlySet<string>;
  onReplace: (nodeIds: string[]) => void;
  shouldStart?: (event: React.PointerEvent<HTMLElement>) => boolean;
  stopNativeEvents?: boolean;
}) {
  const [marquee, setMarquee] = useState<Rect | undefined>(undefined);
  const startRef = useRef<Point | undefined>(undefined);
  const currentRef = useRef<Point | undefined>(undefined);
  const pointerIdRef = useRef<number | undefined>(undefined);
  const isActiveRef = useRef(false);
  const consumedRef = useRef(false);
  const frameRef = useRef<number | undefined>(undefined);

  const updateSelection = useCallback(() => {
    frameRef.current = undefined;
    const start = startRef.current;
    const current = currentRef.current;
    const surface = surfaceRef.current;
    if (!start || !current || !surface || !isActiveRef.current) return;

    const rect = normalizeRect(start, current);
    setMarquee(rect);
    const selectedIds = [
      ...surface.querySelectorAll<HTMLElement>("[data-selection-node-id]"),
    ].flatMap((card) => {
      const nodeId = card.dataset.selectionNodeId;
      return nodeId &&
        eligibleNodeIds.has(nodeId) &&
        rectFullyContains(rect, card.getBoundingClientRect())
        ? [nodeId]
        : [];
    });
    onReplace(selectedIds);
  }, [eligibleNodeIds, onReplace, surfaceRef]);

  const onPointerDownCapture = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (
        event.button !== 0 ||
        !hasSelectionModifier(event) ||
        (shouldStart !== undefined && !shouldStart(event)) ||
        (event.target instanceof Element &&
          event.target.closest(
            "a, button, input, textarea, select, [contenteditable='true']",
          ))
      ) {
        return;
      }
      startRef.current = { x: event.clientX, y: event.clientY };
      currentRef.current = startRef.current;
      pointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (stopNativeEvents) event.stopPropagation();
    },
    [shouldStart, stopNativeEvents],
  );

  const onPointerMoveCapture = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (!start || pointerIdRef.current !== event.pointerId) return;
      if (stopNativeEvents) event.stopPropagation();
      currentRef.current = { x: event.clientX, y: event.clientY };
      if (!isActiveRef.current) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) < MOVEMENT_THRESHOLD) return;
        isActiveRef.current = true;
        consumedRef.current = true;
      }
      if (frameRef.current === undefined) {
        frameRef.current = requestAnimationFrame(updateSelection);
      }
    },
    [stopNativeEvents, updateSelection],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (pointerIdRef.current !== event.pointerId) return;
      if (stopNativeEvents) event.stopPropagation();
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      startRef.current = undefined;
      currentRef.current = undefined;
      pointerIdRef.current = undefined;
      isActiveRef.current = false;
      setMarquee(undefined);
      window.setTimeout(() => {
        consumedRef.current = false;
      });
    },
    [stopNativeEvents],
  );

  const consumeClick = useCallback((event: React.MouseEvent) => {
    if (!consumedRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    return true;
  }, []);

  return {
    marquee,
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture: finish,
    onPointerCancelCapture: finish,
    consumeClick,
  };
}
