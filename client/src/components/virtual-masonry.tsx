import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { columnsForGrid, GRID_GAP, type GridDensity } from "./grid-density";

export function VirtualMasonry({
  children,
  width,
  density,
  scrollElementRef,
  focusedIndex,
  focusRequestId,
}: {
  children: ReactNode;
  width: number;
  density: GridDensity;
  scrollElementRef: RefObject<HTMLDivElement | null>;
  focusedIndex?: number;
  focusRequestId?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const items = useMemo(
    () =>
      Children.toArray(children).map((node, index) => ({
        node,
        key:
          isValidElement(node) && node.key !== null
            ? String(node.key)
            : String(index),
      })),
    [children],
  );
  const columns = columnsForGrid(width, density);
  const itemWidth = columns ? (width - GRID_GAP * (columns - 1)) / columns : 0;

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const scroller = scrollElementRef.current;
    if (!container || !scroller) return;
    const update = () =>
      setScrollMargin(
        container.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top +
          scroller.scrollTop,
      );
    update();
    const observer = new ResizeObserver(update);
    if (container.parentElement) observer.observe(container.parentElement);
    return () => observer.disconnect();
  }, [scrollElementRef, width, density, items.length]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollElementRef.current,
    getItemKey: (index) => items[index]?.key ?? index,
    estimateSize: () => 280,
    lanes: Math.max(1, columns),
    laneAssignmentMode: "measured",
    gap: GRID_GAP,
    overscan: 8,
    scrollMargin,
  });

  useEffect(() => {
    if (focusedIndex === undefined || focusedIndex < 0) return;
    virtualizer.scrollToIndex(focusedIndex, {
      align: "center",
      behavior: "smooth",
    });
  }, [focusedIndex, focusRequestId, virtualizer]);

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          data-index={item.index}
          ref={virtualizer.measureElement}
          className="absolute top-0 left-0"
          style={{
            width: itemWidth,
            transform: `translate(${item.lane * (itemWidth + GRID_GAP)}px, ${item.start - scrollMargin}px)`,
          }}
        >
          {items[item.index]?.node}
        </div>
      ))}
    </div>
  );
}
