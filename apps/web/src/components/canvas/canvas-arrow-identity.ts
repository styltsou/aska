import type { CanvasArrowObject } from "@/api/collection";

type ArrowIdentity = Pick<CanvasArrowObject, "id" | "clientId">;

export function arrowHasIdentity(
  arrow: ArrowIdentity,
  objectId: string | undefined,
) {
  return (
    objectId !== undefined &&
    (arrow.id === objectId || arrow.clientId === objectId)
  );
}

export function arrowIsSelected(
  arrow: ArrowIdentity,
  selectedIds: ReadonlySet<string>,
) {
  return (
    selectedIds.has(arrow.id) ||
    (arrow.clientId !== undefined && selectedIds.has(arrow.clientId))
  );
}
