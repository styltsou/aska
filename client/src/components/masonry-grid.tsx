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
import { columnsForGrid, GRID_GAP, type GridDensity } from "./grid-density";

export const MASONRY_GAP = GRID_GAP;

type Item = { node: ReactNode; key: string };
export type MasonryPosition = { x: number; y: number; width: number };

export function calculateMasonryLayout(
  heights: readonly number[],
  columns: number,
  itemWidth: number,
  previousColumns?: readonly number[],
  gap = MASONRY_GAP,
): { positions: MasonryPosition[]; height: number } | undefined {
  if (!columns || !heights.length || heights.some((height) => height <= 0)) {
    return undefined;
  }

  const columnHeights = Array<number>(columns).fill(0);
  const positions = heights.map((height, index) => {
    const previous = previousColumns?.[index];
    const column =
      previous !== undefined && previous >= 0 && previous < columns
        ? previous
        : columnHeights.indexOf(Math.min(...columnHeights));
    const position = {
      x: column * (itemWidth + gap),
      y: columnHeights[column]!,
      width: itemWidth,
    };
    columnHeights[column]! += height + gap;
    return position;
  });

  return {
    positions,
    height: Math.max(...columnHeights) - gap,
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
  width,
  density,
  columnCount,
  gap = MASONRY_GAP,
}: {
  children: ReactNode;
  className?: string;
  width?: number;
  density?: GridDensity;
  columnCount?: number;
  gap?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const effectiveWidth = width ?? measuredWidth;
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
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
    columns: number;
    gap: number;
    keys: string[];
  }>({
    positions: [],
    height: 0,
    width: 0,
    columns: 0,
    gap: MASONRY_GAP,
    keys: [],
  });

  const columns = effectiveWidth
    ? (columnCount ?? columnsForGrid(effectiveWidth, density ?? "balanced"))
    : 0;
  const itemWidth = columns
    ? Math.max(0, (effectiveWidth - gap * (columns - 1)) / columns)
    : 0;

  const measure = useCallback(() => {
    if (!effectiveWidth || !items.length) return;

    const heights = itemRefs.current
      .slice(0, items.length)
      .map((el) => el?.offsetHeight ?? 0);
    setLayout((current) => {
      const previousColumns =
        current.columns === columns &&
        current.keys.every((key, index) => key === items[index]?.key)
          ? current.positions.map((position) =>
              Math.round(
                position.x / (current.positions[0]!.width + current.gap),
              ),
            )
          : undefined;
      const next = calculateMasonryLayout(
        heights,
        columns,
        itemWidth,
        previousColumns,
        gap,
      );
      if (!next) return current;
      return current.width === effectiveWidth &&
        current.columns === columns &&
        current.gap === gap &&
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
            width: effectiveWidth,
            columns,
            gap,
            keys: items.map((item) => item.key),
          };
    });
  }, [columns, itemWidth, items, effectiveWidth, gap]);

  // Measure a new set of cards before paint so they never appear stacked at (0, 0).
  useIsomorphicLayoutEffect(measure);
  useIsomorphicLayoutEffect(() => {
    if (width === undefined)
      setMeasuredWidth(containerRef.current?.clientWidth ?? 0);
  });

  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const nodes = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (width === undefined) {
              setMeasuredWidth(containerRef.current?.clientWidth ?? 0);
            }
            if (frameRef.current !== undefined) return;
            frameRef.current = requestAnimationFrame(() => {
              frameRef.current = undefined;
              measure();
            });
          })
        : null;
    if (width === undefined && containerRef.current)
      observer?.observe(containerRef.current);
    nodes.forEach((el) => observer?.observe(el));
    return () => {
      observer?.disconnect();
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
    };
  }, [items, measure, width]);

  // Appending a page should not hide cards that already have valid positions.
  const hasLayout = layout.positions.length > 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className ?? ""}`}
      style={hasLayout ? { height: layout.height } : { visibility: "hidden" }}
    >
      {items.map((item, index) => {
        const pos =
          layout.keys[index] === item.key ? layout.positions[index] : undefined;
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
                : { width: itemWidth || "100%", visibility: "hidden" }
            }
          >
            {item.node}
          </div>
        );
      })}
    </div>
  );
}
