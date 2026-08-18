import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  type Viewport,
} from "@xyflow/react";
import { useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { GLASS_SURFACE_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { usePersistedStore } from "@/store";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";
import { makeBoardKey } from "./canvas-key";

const CARD_WIDTH = 280;
const CARD_GAP = 32;
const GRID_COLUMNS = 5;
const ROW_HEIGHT = 400;
const DEFAULT_VIEWPORT: Viewport = { x: 40, y: 40, zoom: 1.1 };
const FALLBACK_SURFACE = { width: 1200, height: 800 };

const LOADING_CARDS = [
  { id: "image-1", type: "image", height: "h-64", jitter: [-8, -14] as const },
  { id: "note-1", type: "note", height: "", jitter: [10, 6] as const },
  { id: "image-2", type: "image", height: "h-80", jitter: [-14, 10] as const },
  { id: "folder-1", type: "folder", height: "", jitter: [6, -10] as const },
  { id: "image-3", type: "image", height: "h-48", jitter: [12, 12] as const },
  { id: "note-2", type: "note", height: "", jitter: [-10, 8] as const },
  { id: "image-4", type: "image", height: "h-56", jitter: [8, -6] as const },
  { id: "folder-2", type: "folder", height: "", jitter: [-6, 14] as const },
  { id: "image-5", type: "image", height: "h-72", jitter: [14, -8] as const },
  { id: "note-3", type: "note", height: "", jitter: [-12, -12] as const },
] as const;

type CanvasLoadingProps = {
  workspaceSlug?: string;
  collectionSlug?: string;
  folderPath?: string;
};

export function CanvasLoading({
  workspaceSlug,
  collectionSlug,
  folderPath,
}: CanvasLoadingProps) {
  const boardKey =
    workspaceSlug && collectionSlug
      ? makeBoardKey(workspaceSlug, collectionSlug, folderPath)
      : undefined;
  const storedViewport = usePersistedStore((state) =>
    boardKey ? state.boardViewports[boardKey] : undefined,
  );
  const viewport = storedViewport ?? DEFAULT_VIEWPORT;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState(FALLBACK_SURFACE);

  useIsomorphicLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const update = () =>
      setSurface({ width: el.clientWidth, height: el.clientHeight });
    update();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);

  const gridWidth = GRID_COLUMNS * CARD_WIDTH + (GRID_COLUMNS - 1) * CARD_GAP;
  const gridHeight = 2 * ROW_HEIGHT + CARD_GAP;
  const gridLeft =
    (surface.width / 2 - viewport.x) / viewport.zoom - gridWidth / 2;
  const gridTop =
    (surface.height / 2 - viewport.y) / viewport.zoom - gridHeight / 2;

  return (
    <ReactFlowProvider>
      <div
        ref={surfaceRef}
        className="relative h-full min-h-0 w-full bg-transparent"
        role="status"
        aria-label="Loading collection canvas"
      >
        <span className="sr-only">Loading collection canvas</span>
        <ReactFlow
          className="aska-flow"
          nodes={[]}
          minZoom={1}
          maxZoom={1}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="color-mix(in oklch, var(--foreground) 14%, transparent)"
          />
        </ReactFlow>
        <div
          className="pointer-events-none absolute top-0 left-0"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: "top left",
          }}
        >
          <div className="relative">
            {LOADING_CARDS.map((card, index) => {
              const column = index % GRID_COLUMNS;
              const row = Math.floor(index / GRID_COLUMNS);
              return (
                <div
                  key={card.id}
                  className="absolute"
                  style={{
                    left:
                      gridLeft +
                      column * (CARD_WIDTH + CARD_GAP) +
                      card.jitter[0] / viewport.zoom,
                    top:
                      gridTop +
                      row * ROW_HEIGHT +
                      card.jitter[1] / viewport.zoom,
                  }}
                >
                  <LoadingCard {...card} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="pointer-events-none absolute right-3 bottom-3">
          <div
            className={cn(
              "flex flex-col gap-px rounded-md p-1",
              GLASS_SURFACE_CLASS,
            )}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-1">
                <Skeleton className="size-5 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

function LoadingCard({ type, height }: (typeof LOADING_CARDS)[number]) {
  const widthClass = "w-[280px] max-md:w-[200px]";

  if (type === "note") {
    return (
      <div className={`${widthClass} rounded-lg border bg-sidebar p-4`}>
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-3 h-3 w-4/5" />
        <Skeleton className="mt-3 h-3 w-2/3" />
      </div>
    );
  }

  if (type === "folder") {
    return (
      <div
        className={`relative ${widthClass} overflow-hidden rounded-lg border bg-sidebar`}
      >
        <div className="grid grid-cols-2 gap-3 p-3 pb-12">
          <Skeleton className="aspect-square rounded-sm" />
          <Skeleton className="aspect-square rounded-sm" />
          <Skeleton className="aspect-square rounded-sm" />
          <Skeleton className="aspect-square rounded-sm" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-sidebar/80 px-3 py-2.5">
          <Skeleton className="size-5 shrink-0 rounded-sm" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="ml-auto h-3 w-5" />
        </div>
      </div>
    );
  }

  return <Skeleton className={`${widthClass} rounded-lg ${height}`} />;
}
