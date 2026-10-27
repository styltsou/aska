import {
  Children,
  isValidElement,
  useCallback,
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
  const [layout, setLayout] = useState<{
    positions: MasonryPosition[];
    height: number;
    width: number;
    keys: string[];
  }>({ positions: [], height: 0, width: 0, keys: [] });

  const columns = width ? columnCountFor(width) : 0;
  const itemWidth = columns
    ? Math.max(0, (width - MASONRY_GAP * (columns - 1)) / columns)
    : 0;

  const measure = useCallback(() => {
    const nextWidth = containerRef.current?.clientWidth ?? 0;
    if (nextWidth !== width) {
      setWidth(nextWidth);
      return;
    }
    if (!nextWidth || !items.length) return;

    const heights = itemRefs.current
      .slice(0, items.length)
      .map((el) => el?.offsetHeight ?? 0);
    const next = calculateMasonryLayout(heights, columns, itemWidth);
    if (!next) return;

    setLayout((current) =>
      current.width === width &&
      current.keys.length === items.length &&
      current.keys.every((key, index) => key === items[index]?.key) &&
      layoutsEqual(
        current.positions,
        next.positions,
        current.height,
        next.height,
      )
        ? current
        : {
            ...next,
            width,
            keys: items.map((item) => item.key),
          },
    );
  }, [columns, itemWidth, items, width]);

  // Measure a new set of cards before paint so they never appear stacked at (0, 0).
  useIsomorphicLayoutEffect(measure);

  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (frameRef.current !== undefined) return;
            frameRef.current = requestAnimationFrame(() => {
              frameRef.current = undefined;
              measure();
            });
          })
        : null;
    if (containerRef.current) observer?.observe(containerRef.current);
    nodes.forEach((el) => observer?.observe(el));
    return () => {
      observer?.disconnect();
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
    };
  }, [items, measure]);

  const isReady =
    width > 0 &&
    layout.width === width &&
    layout.keys.length === items.length &&
    layout.keys.every((key, index) => key === items[index]?.key);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className ?? ""}`}
      style={isReady ? { height: layout.height } : { visibility: "hidden" }}
    >
      {items.map((item, index) => {
        const pos = isReady ? layout.positions[index] : undefined;
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
                : { width: itemWidth || "100%" }
            }
          >
            {item.node}
          </div>
        );
      })}
    </div>
  );
}
