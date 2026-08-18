import type { CollectionNode } from "@/api/collection";

/**
 * Browse is a chronological projection, independent of the authored canvas
 * positions. Keep the original order as a deterministic fallback for malformed
 * timestamps and as the tie-breaker for batch-created nodes.
 */
export function sortCollectionNodesByMostRecent(
  nodes: readonly CollectionNode[],
): CollectionNode[] {
  return nodes
    .map((node, index) => ({ node, index, time: Date.parse(node.createdAt) }))
    .sort((left, right) => {
      const leftHasTime = Number.isFinite(left.time);
      const rightHasTime = Number.isFinite(right.time);

      if (leftHasTime && rightHasTime) {
        return right.time - left.time || left.index - right.index;
      }
      if (leftHasTime) return -1;
      if (rightHasTime) return 1;
      return left.index - right.index;
    })
    .map(({ node }) => node);
}
