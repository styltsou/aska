import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";

export const MASONRY_GAP = 10;

/** Minimum comfortable width for a single card before dropping a column. */
const MIN_COLUMN_WIDTH = 260;

function columnCountFor(width: number): number {
  const raw = Math.floor(
    (width + MASONRY_GAP) / (MIN_COLUMN_WIDTH + MASONRY_GAP),
  );
  return Math.max(1, Math.min(6, raw));
}

type Item = { node: ReactNode; key: string };
export type MasonryPosition = { x: number; y: number; width: number };

export function calculateMasonryLayout(
  heights: readonly number[],
  columns: number,
  itemWidth: number,
): { positions: MasonryPosition[]; height: number } | undefined {
  if (!columns || !heights.length || heights.some((height) => height <= 0)) {
    return undefined;
  }

  const columnHeights = Array<number>(columns).fill(0);
  const positions = heights.map((height) => {
    const column = columnHeights.indexOf(Math.min(...columnHeights));
    const position = {
      x: column * (itemWidth + MASONRY_GAP),
      y: columnHeights[column]!,
      width: itemWidth,
    };
    columnHeights[column]! += height + MASONRY_GAP;
    return position;
  });

  return {
    positions,
    height: Math.max(...columnHeights) - MASONRY_GAP,
  };
}

function layoutsEqual(
  current: readonly MasonryPosition[],
  next: readonly MasonryPosition[],
  currentHeight: number,
  nextHeight: number,
) {
  return (
    currentHeight === nextHeight &&
    current.length === next.length &&
    current.every(
      (position, index) =>
        position.x === next[index]?.x &&
        position.y === next[index]?.y &&
        position.width === next[index]?.width,
    )
  );
}

export function Masonry({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const items = useMemo<Item[]>(
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
  const [positions, setPositions] = useState<MasonryPosition[]>([]);
  const [height, setHeight] = useState(0);
  const layoutRef = useRef({ positions, height });
  layoutRef.current = { positions, height };

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const nextWidth = el.clientWidth;
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    update();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  const columns = width ? columnCountFor(width) : 0;
  const itemWidth = columns
    ? Math.max(0, (width - MASONRY_GAP * (columns - 1)) / columns)
    : 0;

  const frameRef = useRef<number | undefined>(undefined);
  const scheduleRecompute = useRef<() => void>(() => {});
  scheduleRecompute.current = () => {
    if (frameRef.current !== undefined) return;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      const heights = itemRefs.current
        .slice(0, items.length)
        .map((el) => el?.offsetHeight ?? 0);
      const layout = calculateMasonryLayout(heights, columns, itemWidth);
      if (!layout) return;

      const current = layoutRef.current;
      if (
        layoutsEqual(
          current.positions,
          layout.positions,
          current.height,
          layout.height,
        )
      ) {
        return;
      }

      layoutRef.current = layout;
      setPositions(layout.positions);
      setHeight(layout.height);
    });
  };

  useEffect(() => {
    scheduleRecompute.current();
    const nodes = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => scheduleRecompute.current())
        : null;
    nodes.forEach((el) => observer?.observe(el));
    return () => {
      observer?.disconnect();
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
    };
  }, [columns, items, itemWidth]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className ?? ""}`}
      style={height ? { height } : undefined}
    >
      {items.map((item, index) => {
        const pos = positions[index];
        return (
          <div
            key={item.key}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className="absolute top-0 left-0"
            style={
              pos
                ? ({
                    width: pos.width,
                    transform: `translate(${pos.x}px, ${pos.y}px)`,
                  } satisfies CSSProperties)
                : { width: itemWidth || undefined }
            }
          >
            {item.node}
          </div>
        );
      })}
    </div>
  );
}
