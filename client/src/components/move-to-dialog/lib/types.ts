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
  measurements?: Array<{
    id: string;
    width: number;
    height: number;
    position?: { x: number; y: number };
  }>;
  arrowSnapshots?: Array<{
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    points: Array<{ x: number; y: number }>;
  }>;
  includedArrowIds?: string[];
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
