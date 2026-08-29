const EXPANDED_NOTE_Z_INDEX_BASE = 10;
const INTERACTION_NODE_Z_INDEX_BASE = 1_000_000;

type ExpandableCanvasNode = {
  id: string;
  type: string;
  isExpanded?: boolean;
};

function isExpandedNote(node: ExpandableCanvasNode): boolean {
  return node.type === "note" && node.isExpanded === true;
}

/**
 * Keeps expanded notes ordered from back to front. Newly expanded notes are
 * appended so they paint above notes that were already expanded.
 */
export function updateExpandedNoteOrder(
  currentOrder: readonly string[],
  nodes: readonly ExpandableCanvasNode[],
): string[] {
  const expandedIds = new Set(
    nodes.filter(isExpandedNote).map((node) => node.id),
  );
  const nextOrder = currentOrder.filter((nodeId) => expandedIds.has(nodeId));
  const orderedIds = new Set(nextOrder);

  for (const node of nodes) {
    if (!isExpandedNote(node) || orderedIds.has(node.id)) continue;

    nextOrder.push(node.id);
    orderedIds.add(node.id);
  }

  return nextOrder;
}

export function getCanvasRestingZIndex(
  node: ExpandableCanvasNode,
  expandedNoteOrder: readonly string[],
): number {
  if (!isExpandedNote(node)) return 0;

  const order = expandedNoteOrder.indexOf(node.id);
  return EXPANDED_NOTE_Z_INDEX_BASE + Math.max(order, 0);
}

export function getCanvasInteractionZIndex(stackOrder = 0): number {
  return INTERACTION_NODE_Z_INDEX_BASE + stackOrder;
}
