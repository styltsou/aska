import { useCallback, useMemo, useRef } from "react";
import {
  useMutation,
  useQueryClient,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createCanvasArrow,
  createCanvasText,
  deleteCanvasObject,
  updateCanvasArrow,
  updateCanvasText,
  updateCanvasItemFrontIndexes,
} from "./fetchers";
import type {
  CanvasItemFrontIndex,
  CanvasObject,
  CanvasObjectResponse,
  CollectionContentsResponse,
  CreateCanvasArrowInput,
  CreateCanvasTextInput,
  UpdateCanvasArrowInput,
  UpdateCanvasTextInput,
  UpdateCanvasItemFrontIndexesInput,
} from "./types";
import { createLatestPatchQueue } from "./latest-patch-queue";

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

type CanvasObjectType = CanvasObject["type"];
type CanvasObjectUpdateVariables<TPatch> = TPatch & { objectId: string };

export function createCanvasObjectUpdateQueue<TPatch extends object>({
  queryClient,
  filter,
  objectType,
  save,
}: {
  queryClient: QueryClient;
  filter: ReturnType<typeof contentsFilter>;
  objectType: CanvasObjectType;
  save: (objectId: string, patch: TPatch) => Promise<CanvasObjectResponse>;
}) {
  const confirmedObjects = new Map<string, CanvasObject | undefined>();
  const queue = createLatestPatchQueue<TPatch, CanvasObjectResponse>({
    save,
    merge: (current, next) => ({ ...current, ...next }),
    onSuccess: (objectId, { object }, hasPending) => {
      const previous = confirmedObjects.get(objectId);
      const persisted = previous?.clientId
        ? { ...object, clientId: previous.clientId }
        : object;
      confirmedObjects.set(objectId, persisted);
      if (hasPending) return;

      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) =>
          updateObjectInContents(current, objectId, (candidate) =>
            candidate.type === objectType && object.type === objectType
              ? persisted
              : candidate,
          ),
      );
      confirmedObjects.delete(objectId);
    },
    onError: (objectId, _error, hasPending) => {
      if (hasPending) return;

      const confirmed = confirmedObjects.get(objectId);
      if (confirmed) {
        queryClient.setQueriesData<CollectionContentsResponse>(
          filter,
          (current) =>
            updateObjectInContents(current, objectId, (candidate) =>
              candidate.type === objectType && confirmed.type === objectType
                ? confirmed
                : candidate,
            ),
        );
      } else {
        void queryClient.invalidateQueries(filter);
      }
      confirmedObjects.delete(objectId);
    },
  });

  return {
    enqueue(objectId: string, patch: TPatch) {
      void queryClient.cancelQueries(filter);

      if (!confirmedObjects.has(objectId)) {
        const confirmed = queryClient
          .getQueriesData<CollectionContentsResponse>(filter)
          .flatMap(([, current]) => current?.canvasObjects ?? [])
          .find(
            (object) => object.id === objectId && object.type === objectType,
          );
        confirmedObjects.set(objectId, confirmed);
      }

      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) =>
          updateObjectInContents(current, objectId, (object) =>
            object.type === objectType ? { ...object, ...patch } : object,
          ),
      );
      return queue.enqueue(objectId, patch);
    },
  };
}

function useQueuedCanvasObjectUpdate<TPatch extends object>(
  filter: ReturnType<typeof contentsFilter>,
  objectType: CanvasObjectType,
  save: (objectId: string, patch: TPatch) => Promise<CanvasObjectResponse>,
) {
  const queryClient = useQueryClient();
  const requests = useRef(
    new WeakMap<
      CanvasObjectUpdateVariables<TPatch>,
      Promise<CanvasObjectResponse>
    >(),
  );
  const updateQueue = useMemo(
    () =>
      createCanvasObjectUpdateQueue({
        queryClient,
        filter,
        objectType,
        save,
      }),
    [filter, objectType, queryClient, save],
  );

  return useMutation({
    mutationFn: (variables: CanvasObjectUpdateVariables<TPatch>) => {
      const queued = requests.current.get(variables);
      if (queued) {
        requests.current.delete(variables);
        return queued;
      }

      const { objectId, ...patch } = variables;
      return updateQueue.enqueue(objectId, patch as TPatch);
    },
    onMutate: (variables) => {
      const { objectId, ...patch } = variables;
      requests.current.set(
        variables,
        updateQueue.enqueue(objectId, patch as TPatch),
      );
    },
  });
}

export function updateFrontIndexesInContents(
  current: CollectionContentsResponse | undefined,
  items: readonly CanvasItemFrontIndex[],
) {
  if (!current) return current;
  const frontIndexes = new Map(
    items.map((item) => [item.id, item.frontIndex] as const),
  );
  return {
    ...current,
    nodes: current.nodes.map((node) => {
      const frontIndex = frontIndexes.get(node.id);
      return frontIndex === undefined ? node : { ...node, frontIndex };
    }),
    canvasObjects: current.canvasObjects.map((object) => {
      const frontIndex = frontIndexes.get(object.id);
      return object.type !== "text" || frontIndex === undefined
        ? object
        : { ...object, frontIndex };
    }),
  };
}

type UpdateCanvasItemFrontIndexesVariables =
  UpdateCanvasItemFrontIndexesInput & {
    folderPath?: string;
    optimisticItems: CanvasItemFrontIndex[];
  };

export function useUpdateCanvasItemFrontIndexes(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
) {
  const queryClient = useQueryClient();
  const filter = contentsFilter(workspaceSlug, collectionSlug, folderPath);
  return useMutation({
    mutationFn: ({
      optimisticItems: _optimisticItems,
      folderPath: _folderPath,
      ...data
    }: UpdateCanvasItemFrontIndexesVariables) =>
      updateCanvasItemFrontIndexes(workspaceSlug, collectionSlug, data),
    onMutate: async ({ optimisticItems }) => {
      await queryClient.cancelQueries(filter);
      const previous =
        queryClient.getQueriesData<CollectionContentsResponse>(filter);
      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) => updateFrontIndexesInContents(current, optimisticItems),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]: [QueryKey, unknown]) => {
        queryClient.setQueryData(key, value);
      });
      toast.error("Unable to save the canvas layer order.");
    },
    onSuccess: ({ items }) => {
      queryClient.setQueriesData<CollectionContentsResponse>(
        filter,
        (current) => updateFrontIndexesInContents(current, items),
      );
    },
  });
}

type CreateCanvasTextVariables = CreateCanvasTextInput & {
  clientId?: string;
};

export function useCreateCanvasText(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId: _clientId, ...data }: CreateCanvasTextVariables) =>
      createCanvasText(workspaceSlug, collectionSlug, data),
    onSuccess: ({ object }, variables) => {
      if (object.type !== "text") return;
      const persisted =
        variables.clientId === undefined
          ? object
          : { ...object, clientId: variables.clientId };
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
                  (candidate) => candidate.id === persisted.id,
                )
                  ? current.canvasObjects
                  : [...current.canvasObjects, persisted],
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
  const filter = useMemo(
    () => contentsFilter(workspaceSlug, collectionSlug, folderPath),
    [workspaceSlug, collectionSlug, folderPath],
  );
  const save = useCallback(
    (objectId: string, data: UpdateCanvasTextInput) =>
      updateCanvasText(workspaceSlug, collectionSlug, objectId, data),
    [workspaceSlug, collectionSlug],
  );
  return useQueuedCanvasObjectUpdate(filter, "text", save);
}

export function useUpdateCanvasArrow(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
) {
  const filter = useMemo(
    () => contentsFilter(workspaceSlug, collectionSlug, folderPath),
    [workspaceSlug, collectionSlug, folderPath],
  );
  const save = useCallback(
    (objectId: string, data: UpdateCanvasArrowInput) =>
      updateCanvasArrow(workspaceSlug, collectionSlug, objectId, data),
    [workspaceSlug, collectionSlug],
  );
  return useQueuedCanvasObjectUpdate(filter, "arrow", save);
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
