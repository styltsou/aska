export function makeBoardKey(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
): string {
  return `${workspaceSlug}/${collectionSlug}/${folderPath ?? ""}`;
}
