import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";

import { Skeleton } from "@/components/ui/skeleton";

const LOADING_CARDS = [
  { id: "image-1", type: "image", height: "h-64" },
  { id: "note-1", type: "note", height: "" },
  { id: "image-2", type: "image", height: "h-80" },
  { id: "folder-1", type: "folder", height: "" },
  { id: "image-3", type: "image", height: "h-48" },
] as const;

export function CanvasLoading() {
  return (
    <ReactFlowProvider>
      <div
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden p-8 max-md:p-5">
          <div className="grid max-w-[880px] grid-cols-3 items-start gap-6 max-xl:grid-cols-2 max-md:grid-cols-1">
            {LOADING_CARDS.map((card) => (
              <LoadingCard key={card.id} {...card} />
            ))}
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

function LoadingCard({ type, height }: (typeof LOADING_CARDS)[number]) {
  if (type === "note") {
    return (
      <div className="w-[280px] rounded-lg border bg-sidebar p-4 max-md:w-full">
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-3 h-3 w-4/5" />
        <Skeleton className="mt-3 h-3 w-2/3" />
      </div>
    );
  }

  if (type === "folder") {
    return (
      <div className="relative w-[280px] overflow-hidden rounded-lg border bg-sidebar max-md:w-full">
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

  return (
    <Skeleton className={`w-[280px] rounded-lg max-md:w-full ${height}`} />
  );
}
