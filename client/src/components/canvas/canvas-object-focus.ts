export function activeCanvasObjectFocus(
  focusedObjectId: string | undefined,
  selectedIds: readonly string[],
) {
  return focusedObjectId !== undefined &&
    selectedIds.length === 1 &&
    selectedIds[0] === focusedObjectId
    ? focusedObjectId
    : undefined;
}
