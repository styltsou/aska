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
  const [positions, setPositions] = useState<
    { x: number; y: number; width: number }[]
  >([]);
  const [height, setHeight] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
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

  const recompute = useRef<() => void>(() => {});
  recompute.current = () => {
    if (!columns || !items.length) return;
    const heights = itemRefs.current.map((el) => el?.offsetHeight ?? 0);
    if (heights.some((h) => h === 0)) return;

    const colHeights = Array<number>(columns).fill(0);
    const next = items.map((_, index) => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const pos = {
        x: col * (itemWidth + MASONRY_GAP),
        y: colHeights[col],
        width: itemWidth,
      };
      colHeights[col] += heights[index] + MASONRY_GAP;
      return pos;
    });

    setPositions(next);
    setHeight(Math.max(...colHeights) - MASONRY_GAP);
  };

  useEffect(() => {
    recompute.current();
    const nodes = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => recompute.current())
        : null;
    nodes.forEach((el) => observer?.observe(el));
    return () => observer?.disconnect();
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
