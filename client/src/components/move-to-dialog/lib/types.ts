import type { Breadcrumb, CollectionFolderNode } from "@/api/collection";

/**
 * A set of nodes to move. When `sourceCollectionSlug` is set the nodes move
 * within that collection (and may include folders); when it is omitted the
 * nodes come from Inbox (assets only) and the destination collection is chosen
 * by the user, defaulting to the first collection.
 */
export type MoveToDialogSource = {
  workspaceSlug: string;
  nodeIds: string[];
  sourceCollectionSlug?: string;
  sourceFolderPath?: string;
};

export type Crumb = {
  id: string | number;
  name: string;
  slug: string;
};

export type FolderDestination = {
  collectionName: string;
  breadcrumbs: Breadcrumb[];
  folders: CollectionFolderNode[];
  isLoading: boolean;
  isError: boolean;
  isStale: boolean;
  prefetch: (folderPath: string) => void;
};
