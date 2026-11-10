export const RESTING_CARD_Z_INDEX = 0;
export const RESTING_TEXT_Z_INDEX = 1;
export const EXPANDED_NOTE_Z_INDEX_BASE = 10;
export const FRONT_Z_INDEX_BASE = 10_000;
export const MAX_FRONT_INDEX = 100_000;
export const ARROW_Z_INDEX = 500_000;
export const OVERLAY_Z_INDEX = 600_000;
export const INTERACTION_NODE_Z_INDEX_BASE = 1_000_000;

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
  frontIndex?: number | null,
): number {
  if (frontIndex != null) return getCanvasFrontZIndex(frontIndex);
  if (!isExpandedNote(node)) return RESTING_CARD_Z_INDEX;

  // A board is assumed to have far fewer than 10k simultaneously expanded
  // notes, keeping this resting band below FRONT_Z_INDEX_BASE.
  const order = expandedNoteOrder.indexOf(node.id);
  return EXPANDED_NOTE_Z_INDEX_BASE + Math.max(order, 0);
}

export function getCanvasFrontZIndex(frontIndex: number): number {
  return FRONT_Z_INDEX_BASE + frontIndex;
}

export function getCanvasTextRestingZIndex(frontIndex?: number | null): number {
  return frontIndex == null
    ? RESTING_TEXT_Z_INDEX
    : getCanvasFrontZIndex(frontIndex);
}

export function renumberFrontIndexes(
  frontIndexes: ReadonlyMap<string, number>,
): { indexes: Map<string, number>; next: number } {
  const indexes = new Map<string, number>();
  [...frontIndexes.entries()]
    .sort((left, right) => left[1] - right[1])
    .forEach(([id], index) => indexes.set(id, index));
  return { indexes, next: indexes.size };
}

/** Builds the immediate optimistic order; the server response stays canonical. */
export function promoteCanvasFrontIndexes(
  frontIndexes: ReadonlyMap<string, number>,
  itemIdsBottomToTop: readonly string[],
): Map<string, number> {
  const indexes = new Map(frontIndexes);
  itemIdsBottomToTop.forEach((id) => indexes.delete(id));
  const currentMax = [...frontIndexes.values()].reduce(
    (maximum, value) => Math.max(maximum, value),
    -1,
  );
  let next = currentMax + 1;

  if (currentMax + itemIdsBottomToTop.length > MAX_FRONT_INDEX) {
    const renumbered = renumberFrontIndexes(indexes);
    indexes.clear();
    renumbered.indexes.forEach((value, id) => indexes.set(id, value));
    next = renumbered.next;
  }

  itemIdsBottomToTop.forEach((id) => {
    indexes.set(id, next);
    next += 1;
  });
  return indexes;
}

export function getCanvasInteractionZIndex(stackOrder = 0): number {
  return INTERACTION_NODE_Z_INDEX_BASE + stackOrder;
}
