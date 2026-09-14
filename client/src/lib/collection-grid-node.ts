import type { CollectionNode } from "@/api/collection";

type CanvasOnlyNodeType = "arrow" | "text" | "raw-text";

const CANVAS_ONLY_NODE_TYPES = new Set<CanvasOnlyNodeType>([
  "arrow",
  "text",
  "raw-text",
]);

/**
 * The grid is an inventory of collection assets, not a projection of canvas
 * annotations or relationships. Keep spatial-only primitives on the canvas.
 */
export function isGridRenderableNode(
  node: CollectionNode,
): node is Exclude<CollectionNode, { type: CanvasOnlyNodeType }> {
  return !CANVAS_ONLY_NODE_TYPES.has(
    (node as { type: string }).type as CanvasOnlyNodeType,
  );
}
