import { useEffect, useRef, type RefObject } from "react";
import { ArrowUpRightIcon, TypeIcon } from "lucide-react";

import type { CanvasTool } from "@/store/slices/board-slice";

const CURSOR_OFFSET = 12;

function CanvasToolCursorIndicator({
  tool,
  boardRef,
}: {
  tool: CanvasTool;
  boardRef: RefObject<HTMLDivElement | null>;
}) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const syncIndicatorRef = useRef<() => void>(() => {});

  syncIndicatorRef.current = () => {
    const indicator = indicatorRef.current;
    const pointer = lastPointerRef.current;
    const board = boardRef.current;
    const pane = board?.querySelector(".react-flow__pane");
    const target = pointer
      ? document.elementFromPoint(pointer.x, pointer.y)
      : null;

    if (
      !indicator ||
      (tool !== "text" && tool !== "arrow") ||
      !pointer ||
      !pane ||
      target !== pane
    ) {
      if (indicator) indicator.style.opacity = "0";
      return;
    }

    indicator.style.transform = `translate(${pointer.x + CURSOR_OFFSET}px, ${pointer.y + CURSOR_OFFSET}px)`;
    indicator.style.opacity = "1";
  };

  useEffect(() => {
    const updatePosition = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      syncIndicatorRef.current();
    };

    const hideIndicator = () => {
      const indicator = indicatorRef.current;
      if (indicator) indicator.style.opacity = "0";
    };

    const board = boardRef.current;
    window.addEventListener("pointermove", updatePosition);
    window.addEventListener("blur", hideIndicator);
    board?.addEventListener("pointerenter", updatePosition);
    board?.addEventListener("pointerleave", hideIndicator);
    return () => {
      window.removeEventListener("pointermove", updatePosition);
      window.removeEventListener("blur", hideIndicator);
      board?.removeEventListener("pointerenter", updatePosition);
      board?.removeEventListener("pointerleave", hideIndicator);
    };
  }, [boardRef]);

  useEffect(() => {
    syncIndicatorRef.current();
  }, [tool]);

  if (tool !== "text" && tool !== "arrow") return null;

  return (
    <div
      ref={indicatorRef}
      className="pointer-events-none fixed top-0 left-0 z-50 opacity-0"
      aria-hidden="true"
    >
      <span className="flex size-7 items-center justify-center rounded-full border border-primary/30 bg-background/95 text-primary shadow-sm">
        {tool === "text" ? (
          <TypeIcon className="size-3" />
        ) : (
          <ArrowUpRightIcon className="size-4" />
        )}
      </span>
    </div>
  );
}

export { CanvasToolCursorIndicator };
