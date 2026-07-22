export type SidebarCollectionLocation = {
  workspaceSlug: string;
  collectionSlug?: string;
  folderSegments: string[];
  folderPath?: string;
};

export function getSidebarCollectionLocation(
  pathname: string,
): SidebarCollectionLocation {
  const workspaceSlug = pathname.split("/")[1] || "personal";
  const collectionPath = pathname.match(/^\/[^/]+\/collections\/(.+)/)?.[1];
  const [collectionSlug, ...folderSegments] = collectionPath?.split("/") ?? [];

  return {
    workspaceSlug,
    collectionSlug,
    folderSegments,
    folderPath: folderSegments.join("/") || undefined,
  };
}

export function makeChildFolderPath(
  collectionSlug: string,
  folderSegments: string[],
  childSlug: string,
): string {
  return [collectionSlug, ...folderSegments, childSlug].join("/");
}
