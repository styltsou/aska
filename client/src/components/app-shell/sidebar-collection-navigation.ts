import { parseWorkspaceAssetPath } from "@/lib/workspace-asset-url";

export type SidebarCollectionLocation = {
  workspaceSlug: string;
  collectionSlug?: string;
  folderSegments: string[];
  folderPath?: string;
};

export function getSidebarCollectionLocation(
  pathname: string,
): SidebarCollectionLocation {
  pathname = parseWorkspaceAssetPath(pathname).boardPathname;
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
