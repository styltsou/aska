export function retainSelectableIds(
  selectedIds: readonly string[],
  eligibleNodeIds: ReadonlySet<string>,
  previouslyEligibleNodeIds: ReadonlySet<string>,
  pendingNodeIds: ReadonlySet<string>,
): string[] {
  return selectedIds.filter(
    (nodeId) =>
      eligibleNodeIds.has(nodeId) ||
      pendingNodeIds.has(nodeId) ||
      !previouslyEligibleNodeIds.has(nodeId),
  );
}
