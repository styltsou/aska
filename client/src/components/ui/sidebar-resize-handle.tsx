import { useEffect, useRef } from "react";
import {
  clampSidebarWidth,
  getSidebarMaxWidth,
  saveSidebarWidth,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/sidebar-width";

export function SidebarResizeHandle({
  side,
  controls,
}: {
  side: "left" | "right";
  controls: string;
}) {
  const handleRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    originalWidth: string;
    width: number;
    root: HTMLElement;
    restore: () => void;
  } | null>(null);

  function setWidth(root: HTMLElement, width: number) {
    const next = clampSidebarWidth(width, window.innerWidth);
    root.style.setProperty("--sidebar-preferred-width", `${next}px`);
    handleRef.current?.setAttribute("aria-valuenow", String(Math.round(next)));
    return next;
  }

  function finish(cancel = false) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (cancel) {
      drag.root.style.setProperty(
        "--sidebar-preferred-width",
        drag.originalWidth,
      );
    } else {
      saveSidebarWidth(drag.root.dataset.sidebarWidthKey, drag.width);
    }
    // Commit the last width before restoring collapse/expand transitions.
    drag.root.getBoundingClientRect();
    drag.root.removeAttribute("data-sidebar-resizing");
    drag.restore();
    if (handleRef.current?.hasPointerCapture(drag.pointerId)) {
      handleRef.current.releasePointerCapture(drag.pointerId);
    }
  }

  useEffect(() => {
    const handle = handleRef.current;
    const panel = handle?.parentElement;
    if (!handle || !panel) return;
    const updateAria = () => {
      handle.setAttribute(
        "aria-valuemax",
        String(getSidebarMaxWidth(window.innerWidth)),
      );
      handle.setAttribute(
        "aria-valuenow",
        String(Math.round(panel.getBoundingClientRect().width)),
      );
    };
    updateAria();
    const observer = new ResizeObserver(updateAria);
    observer.observe(panel);
    window.addEventListener("resize", updateAria);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateAria);
      const drag = dragRef.current;
      if (drag) {
        drag.root.removeAttribute("data-sidebar-resizing");
        drag.restore();
        dragRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={handleRef}
      role="separator"
      tabIndex={0}
      aria-label="Resize sidebar"
      aria-orientation="vertical"
      aria-controls={controls}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={SIDEBAR_DEFAULT_WIDTH}
      aria-description="Use left and right arrow keys to resize, Shift for larger steps, or Home and End for minimum and maximum width."
      title="Drag or use arrow keys to resize. Double-click to reset."
      className={`absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none before:absolute before:inset-y-2 before:left-1/2 before:w-px before:bg-transparent hover:before:bg-sidebar-border focus-visible:before:bg-sidebar-ring ${side === "left" ? "-right-1" : "-left-1"}`}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || dragRef.current) return;
        const root = event.currentTarget.closest<HTMLElement>(
          '[data-slot="sidebar-wrapper"]',
        );
        const panel = event.currentTarget.parentElement;
        if (!root || !panel) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        const width = panel.getBoundingClientRect().width;
        const originalWidth = root.style.getPropertyValue(
          "--sidebar-preferred-width",
        );
        const { cursor, userSelect } = document.body.style;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        root.setAttribute("data-sidebar-resizing", "");
        setWidth(root, width);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: width,
          originalWidth,
          width,
          root,
          restore: () => {
            document.body.style.cursor = cursor;
            document.body.style.userSelect = userSelect;
          },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        drag.width = setWidth(
          drag.root,
          drag.startWidth +
            (event.clientX - drag.startX) * (side === "left" ? 1 : -1),
        );
      }}
      onPointerUp={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) finish();
      }}
      onPointerCancel={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) finish(true);
      }}
      onLostPointerCapture={(event) => {
        if (dragRef.current?.pointerId === event.pointerId) finish();
      }}
      onDoubleClick={(event) => {
        const root = event.currentTarget.closest<HTMLElement>(
          '[data-slot="sidebar-wrapper"]',
        );
        if (!root) return;
        root.setAttribute("data-sidebar-resizing", "");
        setWidth(root, SIDEBAR_DEFAULT_WIDTH);
        saveSidebarWidth(root.dataset.sidebarWidthKey, SIDEBAR_DEFAULT_WIDTH);
        root.getBoundingClientRect();
        root.removeAttribute("data-sidebar-resizing");
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && dragRef.current) {
          event.preventDefault();
          finish(true);
          return;
        }
        if (
          dragRef.current ||
          !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
        )
          return;
        const root = event.currentTarget.closest<HTMLElement>(
          '[data-slot="sidebar-wrapper"]',
        );
        const panel = event.currentTarget.parentElement;
        if (!root || !panel) return;
        event.preventDefault();
        const step = event.shiftKey ? 32 : 8;
        const delta =
          (event.key === "ArrowRight" ? step : -step) *
          (side === "left" ? 1 : -1);
        const width =
          event.key === "Home"
            ? SIDEBAR_MIN_WIDTH
            : event.key === "End"
              ? getSidebarMaxWidth(window.innerWidth)
              : panel.getBoundingClientRect().width + delta;
        root.setAttribute("data-sidebar-resizing", "");
        const next = setWidth(root, width);
        saveSidebarWidth(root.dataset.sidebarWidthKey, next);
        root.getBoundingClientRect();
        root.removeAttribute("data-sidebar-resizing");
      }}
    />
  );
}
