import type { CanvasItemFrontIndex } from "@/dto/collection.dto";

export const MAX_CANVAS_FRONT_INDEX = 100_000;

/** Returns every changed item, or undefined when the scope cannot fit. */
export function planCanvasFrontIndexUpdates(
  existingItems: readonly CanvasItemFrontIndex[],
  itemIdsBottomToTop: readonly string[],
): CanvasItemFrontIndex[] | undefined {
  const orderedExisting = [...existingItems].sort(
    (left, right) =>
      left.frontIndex - right.frontIndex || left.id.localeCompare(right.id),
  );
  const currentMax = orderedExisting.reduce(
    (maximum, item) => Math.max(maximum, item.frontIndex),
    -1,
  );
  const requiresRebase =
    currentMax + itemIdsBottomToTop.length > MAX_CANVAS_FRONT_INDEX;
  const targetIds = new Set(itemIdsBottomToTop);
  const retained = orderedExisting.filter((item) => !targetIds.has(item.id));

  if (
    requiresRebase &&
    retained.length + itemIdsBottomToTop.length > MAX_CANVAS_FRONT_INDEX + 1
  ) {
    return undefined;
  }

  const updates: CanvasItemFrontIndex[] = [];
  let nextFrontIndex = currentMax + 1;
  if (requiresRebase) {
    nextFrontIndex = 0;
    retained.forEach((item) => {
      updates.push({ id: item.id, frontIndex: nextFrontIndex });
      nextFrontIndex += 1;
    });
  }

  itemIdsBottomToTop.forEach((id) => {
    updates.push({ id, frontIndex: nextFrontIndex });
    nextFrontIndex += 1;
  });
  return updates;
}
