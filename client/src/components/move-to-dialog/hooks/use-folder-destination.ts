import { useQueryClient } from "@tanstack/react-query";

import {
  collectionContentsQueryOptions,
  useCollectionContents,
} from "@/api/collection";

import { FOLDER_TYPES } from "../lib/constants";
import type { FolderDestination } from "../lib/types";

export function useFolderDestination(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath: string | undefined,
  enabled: boolean,
  fallbackCollectionName?: string,
): FolderDestination {
  const queryClient = useQueryClient();
  const query = useCollectionContents(
    workspaceSlug,
    collectionSlug,
    folderPath,
    {
      enabled,
      types: FOLDER_TYPES,
    },
  );
  const resolvedPath = query.data?.breadcrumbs
    .map((breadcrumb) => breadcrumb.slug)
    .join("/");
  const requestedPath = folderPath ?? "";
  const isStale =
    query.isPlaceholderData &&
    (resolvedPath !== requestedPath ||
      query.data?.collection.slug !== collectionSlug);
  const data = isStale ? undefined : query.data;

  return {
    collectionName:
      data?.collection.name ?? fallbackCollectionName ?? "Collection",
    breadcrumbs: data?.breadcrumbs ?? [],
    folders:
      data?.nodes.flatMap((node) => (node.type === "folder" ? [node] : [])) ??
      [],
    isLoading: enabled && (query.isLoading || isStale),
    isError: query.isError,
    isStale,
    prefetch: (nextFolderPath) => {
      void queryClient.prefetchQuery(
        collectionContentsQueryOptions(
          workspaceSlug,
          collectionSlug,
          nextFolderPath,
          FOLDER_TYPES,
        ),
      );
    },
  };
}
