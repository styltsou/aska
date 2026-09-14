import {
  useMutation,
  useQueryClient,
  type Query,
  type QueryKey,
} from "@tanstack/react-query";

import {
  createCanvasArrow,
  createCanvasText,
  deleteCanvasObject,
  updateCanvasArrow,
  updateCanvasText,
} from "./fetchers";
import type {
  CanvasObject,
  CollectionContentsResponse,
  CreateCanvasArrowInput,
  CreateCanvasTextInput,
  UpdateCanvasArrowInput,
  UpdateCanvasTextInput,
} from "./types";

function contentsFilter(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
) {
  return {
    predicate: (query: Query) => {
      const [scope, workspace, collection, folder] = query.queryKey;
      return (
        scope === "collectionContents" &&
        workspace === workspaceSlug &&
        collection === collectionSlug &&
        folder === folderPath
      );
    },
  };
}

function updateObjectInContents(
  current: CollectionContentsResponse | undefined,
  objectId: string,
  update: (object: CanvasObject) => CanvasObject,
) {
  if (!current) return current;
  return {
    ...current,
    canvasObjects: current.canvasObjects.map((object) =>
      object.id === objectId ? update(object) : object,
    ),
  };
}

export function useCreateCanvasText(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCanvasTextInput) =>
      createCanvasText(workspaceSlug, collectionSlug, data),
    onSuccess: ({ object }, variables) => {
      if (object.type !== "text") return;
      queryClient.setQueriesData<CollectionContentsResponse>(
        contentsFilter(
          workspaceSlug,
          collectionSlug,
          variables.parentFolderPath,
        ),
        (current) =>
          current
            ? {
                ...current,
                canvasObjects: current.canvasObjects.some(
                  (candidate) => candidate.id === object.id,
                )
                  ? current.canvasObjects
                  : [...current.canvasObjects, object],
              }
            : current,
      );
    },
  });
}

export function useCreateCanvasArrow(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCanvasArrowInput) =>
      createCanvasArrow(workspaceSlug, collectionSlug, data),
    onSuccess: ({ object }, variables) => {
      if (object.type !== "arrow") return;
      queryClient.setQueriesData<CollectionContentsResponse>(
        contentsFilter(
          workspaceSlug,
          collectionSlug,
          variables.parentFolderPath,
        ),
        (current) =>
          current
            ? {
                ...current,
                canvasObjects: current.canvasObjects.some(
                  (candidate) => candidate.id === object.id,
                )
                  ? current.canvasObjects
                  : [...current.canvasObjects, object],
              }
            : current,
      );
    },
  });
}

export function useUpdateCanvasText(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
) {
  const queryClient = useQueryClient();
  const filter = contentsFilter(workspaceSlug, collectionSlug, folderPath);
  return useMutation({
    mutationFn: ({
      objectId,
      ...data
    }: UpdateCanvasTextInput & { objectId: string }) =>
      updateCanvasText(workspaceSlug, collectionSlug, objectId, data),
    onMutate: async ({ objectId, ...data }) => {
      await queryClient.cancelQueries(filter);
      const previous =
        queryClient.getQueriesData<CollectionContentsResponse>(filter);
      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) =>
          updateObjectInContents(current, objectId, (object) =>
            object.type === "text" ? { ...object, ...data } : object,
          ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]: [QueryKey, unknown]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSuccess: ({ object }) => {
      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) => updateObjectInContents(current, object.id, () => object),
      );
    },
  });
}

export function useUpdateCanvasArrow(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
) {
  const queryClient = useQueryClient();
  const filter = contentsFilter(workspaceSlug, collectionSlug, folderPath);
  return useMutation({
    mutationFn: ({
      objectId,
      ...data
    }: UpdateCanvasArrowInput & { objectId: string }) =>
      updateCanvasArrow(workspaceSlug, collectionSlug, objectId, data),
    onMutate: async ({ objectId, ...data }) => {
      await queryClient.cancelQueries(filter);
      const previous =
        queryClient.getQueriesData<CollectionContentsResponse>(filter);
      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) =>
          updateObjectInContents(current, objectId, (object) =>
            object.type === "arrow" ? { ...object, ...data } : object,
          ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]: [QueryKey, unknown]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSuccess: ({ object }) => {
      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) => updateObjectInContents(current, object.id, () => object),
      );
    },
  });
}

export function useDeleteCanvasObject(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
) {
  const queryClient = useQueryClient();
  const filter = contentsFilter(workspaceSlug, collectionSlug, folderPath);
  return useMutation({
    mutationFn: (objectId: string) =>
      deleteCanvasObject(workspaceSlug, collectionSlug, objectId),
    onMutate: async (objectId) => {
      await queryClient.cancelQueries(filter);
      const previous =
        queryClient.getQueriesData<CollectionContentsResponse>(filter);
      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) =>
          current
            ? {
                ...current,
                canvasObjects: current.canvasObjects.filter(
                  (object) => object.id !== objectId,
                ),
              }
            : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]: [QueryKey, unknown]) => {
        queryClient.setQueryData(key, value);
      });
    },
  });
}
