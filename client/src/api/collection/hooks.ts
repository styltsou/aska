import React from "react";
import { toast } from "sonner";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  bulkDeleteNodes,
  fetchCollections,
  createCollection,
  createInboxImageUpload,
  createInboxNote,
  createInboxRemoteImage,
  createFolder,
  createImageUpload,
  createNote,
  createColor,
  createInboxColor,
  createRemoteImage,
  fetchImageUploadStatus,
  fetchInboxImageUploadStatus,
  deleteAsset,
  deleteCollection,
  deleteCollectionNode,
  fetchCollectionContents,
  fetchInboxContents,
  flattenFolder,
  markInboxSeen,
  updateCollectionNodePosition,
  updateCollectionNodePositions,
  updateNote,
} from "./fetchers";
import { makeMarkdownPreview } from "@/lib/markdown-preview";
import type {
  BoardInsertionPlacement,
  CollectionContentsResponse,
  CollectionImageNode,
  CollectionNode,
  ContentTypeFilter,
  CollectionsData,
  CreateCollectionInput,
  CreateImageUploadResponse,
  CreateFolderInput,
  CreateRemoteImageInput,
  CreateNoteInput,
  CreateColorInput,
  FolderChildPreview,
  ImageUploadStatus,
  InboxContentsResponse,
  UpdateNodePositionInput,
  UpdateNodePositionsInput,
  UpdatedNote,
  UpdateNoteInput,
} from "./types";
import type { WorkspaceData } from "@/api/workspace";
import { reserveNodePositions } from "@/components/canvas/canvas-node-layout";
import { BOARD_CARD_WIDTH } from "@/components/canvas/canvas-node-layout";
import { makeBoardKey } from "@/components/canvas/canvas-key";
import { emitBatchPlacementCompleted } from "@/components/canvas/batch-placement-completed";
import { readUploadImageDimensions } from "@/lib/upload-image-dimensions";
import { readRemoteImageDimensions } from "@/lib/remote-image-dimensions";
import { collectionQueryKeys } from "./query-keys";
import { activeLinkRefetchInterval } from "@/api/url-unfurl/hooks";

export { collectionQueryKeys } from "./query-keys";

const COLLECTIONS_STALE_TIME = 60_000;
const COLLECTION_CONTENTS_STALE_TIME = 30_000;
const MAX_COLLECTION_PREVIEWS = 4;
const UPLOAD_POLL_INTERVAL_MS = 1_000;
const UPLOAD_POLL_TIMEOUT_MS = 2 * 60 * 1_000;

type CreateFolderMutationInput = CreateFolderInput & {
  placement?: BoardInsertionPlacement;
};

type CreateNoteMutationInput = CreateNoteInput & {
  placement?: BoardInsertionPlacement;
};

type CreateColorMutationInput = CreateColorInput & {
  placement?: BoardInsertionPlacement;
};

type CreateRemoteImageMutationInput = CreateRemoteImageInput & {
  placement?: BoardInsertionPlacement;
  preview?: {
    url: string;
    /** A browser-cached source to keep visible while `url` is decoded. */
    fallbackUrl?: string;
    width: number;
    height: number;
  };
};

type UploadLocalImagesMutationInput = {
  files: File[];
  parentFolderPath?: string;
  position?: { x: number; y: number };
  placement?: BoardInsertionPlacement;
};

export function collectionsQueryOptions(workspaceSlug: string) {
  return {
    queryKey: collectionQueryKeys.collections(workspaceSlug),
    queryFn: () => fetchCollections(workspaceSlug),
    staleTime: COLLECTIONS_STALE_TIME,
  };
}

export function inboxContentsQueryOptions(
  workspaceSlug: string,
  types?: readonly ContentTypeFilter[],
) {
  const normalizedTypes = types ? [...types].sort() : undefined;
  const typeSignature = normalizedTypes?.join(",");
  return {
    queryKey: collectionQueryKeys.inbox(workspaceSlug, typeSignature),
    queryFn: () => fetchInboxContents(workspaceSlug, normalizedTypes),
    staleTime: COLLECTION_CONTENTS_STALE_TIME,
    refetchInterval: (query: { state: { data: unknown } }) =>
      activeLinkRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
  };
}

export function collectionContentsQueryOptions(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
  types?: readonly ContentTypeFilter[],
) {
  const normalizedTypes = types ? [...types].sort() : undefined;
  const typeSignature = normalizedTypes?.join(",");
  return {
    queryKey: collectionQueryKeys.contents(
      workspaceSlug,
      collectionSlug,
      folderPath,
      typeSignature,
    ),
    queryFn: () =>
      fetchCollectionContents(
        workspaceSlug,
        collectionSlug,
        folderPath,
        normalizedTypes,
      ),
    staleTime: COLLECTION_CONTENTS_STALE_TIME,
    refetchInterval: (query: { state: { data: unknown } }) =>
      activeLinkRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
  };
}

async function waitForProcessedImage(
  fetchStatus: () => Promise<{ upload: ImageUploadStatus }>,
  initialUpload?: ImageUploadStatus,
): Promise<CollectionImageNode> {
  let upload = initialUpload ?? (await fetchStatus()).upload;
  const deadline = Date.now() + UPLOAD_POLL_TIMEOUT_MS;

  while (upload.status !== "completed") {
    if (upload.status === "failed") {
      throw new Error(upload.errorMessage ?? "Image processing failed");
    }
    if (Date.now() >= deadline) {
      throw new Error("Image processing is taking longer than expected");
    }
    await new Promise((resolve) =>
      window.setTimeout(resolve, UPLOAD_POLL_INTERVAL_MS),
    );
    upload = (await fetchStatus()).upload;
  }

  if (!upload.image) {
    throw new Error("Image processing completed without an image result");
  }
  return upload.image;
}

function addPreviewToCollection(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  preview: FolderChildPreview,
) {
  queryClient.setQueryData<CollectionsData>(
    collectionQueryKeys.collections(workspaceSlug),
    (current) => {
      if (!current) return current;

      return {
        collections: current.collections.map((collection) =>
          collection.slug === collectionSlug
            ? {
                ...collection,
                previews: [
                  preview,
                  ...collection.previews.filter(
                    (existing) => existing.assetId !== preview.assetId,
                  ),
                ].slice(0, MAX_COLLECTION_PREVIEWS),
              }
            : collection,
        ),
      };
    },
  );
}

function addPreviewToParentFolder(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  folderPath: string | undefined,
  preview: FolderChildPreview,
  countDelta = 1,
) {
  if (!folderPath) return;

  const folderSlugs = folderPath.split("/");
  for (let index = 0; index < folderSlugs.length; index++) {
    const folderSlug = folderSlugs[index]!;
    const parentFolderPath =
      index === 0 ? undefined : folderSlugs.slice(0, index).join("/");
    const isDirectParent = index === folderSlugs.length - 1;

    queryClient.setQueryData<CollectionContentsResponse>(
      collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        parentFolderPath,
      ),
      (current) => {
        if (!current) return current;

        return {
          ...current,
          nodes: current.nodes.map((node) =>
            node.type === "folder" && node.slug === folderSlug
              ? {
                  ...node,
                  count: Math.max(0, node.count + countDelta),
                  previews: isDirectParent
                    ? [
                        preview,
                        ...node.previews.filter(
                          (existing) => existing.assetId !== preview.assetId,
                        ),
                      ].slice(0, MAX_COLLECTION_PREVIEWS)
                    : node.previews,
                }
              : node,
          ),
        };
      },
    );
  }
}

function removePreviewFromCollection(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  assetId: string,
) {
  queryClient.setQueryData<CollectionsData>(
    collectionQueryKeys.collections(workspaceSlug),
    (current) => {
      if (!current) return current;

      return {
        collections: current.collections.map((collection) =>
          collection.slug === collectionSlug
            ? {
                ...collection,
                previews: collection.previews.filter(
                  (preview) => preview.assetId !== assetId,
                ),
              }
            : collection,
        ),
      };
    },
  );
}

function removePreviewFromParentFolder(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  folderPath: string | undefined,
  assetId: string,
) {
  if (!folderPath) return;

  updateFolderAncestorCounts(
    queryClient,
    workspaceSlug,
    collectionSlug,
    folderPath,
    -1,
    assetId,
  );
}

function updateFolderAncestorCounts(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  folderPath: string | undefined,
  delta: number,
  removedPreviewAssetId?: string,
) {
  if (!folderPath || delta === 0) return;

  const folderSlugs = folderPath.split("/");
  for (let index = 0; index < folderSlugs.length; index++) {
    const folderSlug = folderSlugs[index]!;
    const parentFolderPath =
      index === 0 ? undefined : folderSlugs.slice(0, index).join("/");
    const isDirectParent = index === folderSlugs.length - 1;

    queryClient.setQueryData<CollectionContentsResponse>(
      collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        parentFolderPath,
      ),
      (current) => {
        if (!current) return current;

        return {
          ...current,
          nodes: current.nodes.map((node) =>
            node.type === "folder" && node.slug === folderSlug
              ? {
                  ...node,
                  count: Math.max(0, node.count + delta),
                  previews:
                    isDirectParent && removedPreviewAssetId
                      ? node.previews.filter(
                          (preview) =>
                            preview.assetId !== removedPreviewAssetId,
                        )
                      : node.previews,
                }
              : node,
          ),
        };
      },
    );
  }
}

function updateCollectionAssetCount(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  delta: number,
) {
  if (delta === 0) return;

  queryClient.setQueryData<CollectionsData>(
    collectionQueryKeys.collections(workspaceSlug),
    (current) => {
      if (!current) return current;

      return {
        collections: current.collections.map((collection) =>
          collection.slug === collectionSlug
            ? {
                ...collection,
                assetCount: Math.max(0, collection.assetCount + delta),
              }
            : collection,
        ),
      };
    },
  );
  queryClient.setQueryData<WorkspaceData>(
    ["workspace", workspaceSlug],
    (current) => {
      if (!current) return current;

      return {
        ...current,
        collections: current.collections.map((collection) =>
          collection.slug === collectionSlug
            ? {
                ...collection,
                assetCount: Math.max(0, collection.assetCount + delta),
              }
            : collection,
        ),
      };
    },
  );
}

function updateInboxUnreadCount(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  update: (count: number) => number,
) {
  queryClient.setQueryData<WorkspaceData>(
    ["workspace", workspaceSlug],
    (current) => {
      if (!current) return current;

      return {
        ...current,
        inbox: {
          ...current.inbox,
          unreadCount: Math.max(0, update(current.inbox.unreadCount)),
        },
      };
    },
  );
}

function reconcileCollectionCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
) {
  reconcileCollectionMetadata(queryClient, workspaceSlug);
  void queryClient.invalidateQueries({
    queryKey: collectionQueryKeys.contentScope(workspaceSlug, collectionSlug),
  });
}

function reconcileCollectionMetadata(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
) {
  void Promise.all([
    queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.collections(workspaceSlug),
    }),
    queryClient.invalidateQueries({
      queryKey: ["workspace", workspaceSlug],
    }),
  ]);
}

function appendNodeToInboxContents(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  node: Exclude<CollectionNode, { type: "folder" }>,
) {
  queryClient.setQueryData<InboxContentsResponse>(
    collectionQueryKeys.inbox(workspaceSlug),
    (current) => {
      if (
        !current ||
        current.nodes.some((existing) => existing.id === node.id)
      ) {
        return current;
      }

      return {
        ...current,
        nodes: [node, ...current.nodes],
      };
    },
  );
}

const UNKNOWN_IMAGE_DIMENSIONS = { width: 3, height: 4 };

function makeOptimisticImageNode(
  file: File,
  index: number,
  dimensions = UNKNOWN_IMAGE_DIMENSIONS,
): Extract<CollectionNode, { type: "image" }> & {
  previewObjectUrl: string;
} {
  const previewObjectUrl = URL.createObjectURL(file);
  const id = `image-uploading-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;

  return {
    id,
    type: "image",
    url: previewObjectUrl,
    width: dimensions.width,
    height: dimensions.height,
    title: file.name || null,
    alt: null,
    sourceLabel: null,
    sourceUrl: null,
    isFavorite: false,
    uploadStatus: "uploading",
    uploadProgress: 0,
    previewObjectUrl,
    clientId: id,
    createdAt: new Date().toISOString(),
    position: null,
  };
}

function revokeOptimisticImageUrls(
  images: Array<{ previewObjectUrl?: string }> | undefined,
) {
  for (const image of images ?? []) {
    if (image.previewObjectUrl) {
      URL.revokeObjectURL(image.previewObjectUrl);
    }
  }
}

function updateOptimisticImage(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  folderPath: string | undefined,
  imageId: string,
  update: Partial<Extract<CollectionNode, { type: "image" }>>,
) {
  queryClient.setQueryData<CollectionContentsResponse>(
    collectionQueryKeys.contents(workspaceSlug, collectionSlug, folderPath),
    (current) => {
      if (!current) return current;

      return {
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === imageId && node.type === "image"
            ? { ...node, ...update }
            : node,
        ),
      };
    },
  );
}

function updateOptimisticInboxImage(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  imageId: string,
  update: Partial<Extract<CollectionNode, { type: "image" }>>,
) {
  queryClient.setQueryData<InboxContentsResponse>(
    collectionQueryKeys.inbox(workspaceSlug),
    (current) => {
      if (!current) return current;

      return {
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === imageId && node.type === "image"
            ? { ...node, ...update }
            : node,
        ),
      };
    },
  );
}

function uploadFileToPresignedUrl(
  file: File,
  upload: CreateImageUploadResponse["upload"],
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("PUT", upload.url);
    for (const [key, value] of Object.entries(upload.headers)) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }

      reject(new Error(`Upload failed: ${request.status}`));
    };
    request.onerror = () => reject(new Error("Upload failed."));
    request.onabort = () => reject(new Error("Upload cancelled."));
    request.send(file);
  });
}

export function useCollections(workspaceSlug: string) {
  return useQuery<CollectionsData>({
    ...collectionsQueryOptions(workspaceSlug),
    enabled: !!workspaceSlug,
  });
}

export function useCreateCollection(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCollectionInput) =>
      createCollection(workspaceSlug, data),
    onSuccess: (data) => {
      queryClient.setQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
        (current) => {
          if (
            !current ||
            current.collections.some((c) => c.id === data.collection.id)
          ) {
            return current;
          }

          return {
            collections: [
              {
                ...data.collection,
                assetCount: 0,
                previews: [],
              },
              ...current.collections,
            ],
          };
        },
      );
      queryClient.setQueryData<WorkspaceData>(
        ["workspace", workspaceSlug],
        (current) => {
          if (
            !current ||
            current.collections.some((c) => c.id === data.collection.id)
          ) {
            return current;
          }

          return {
            ...current,
            collections: [
              {
                id: data.collection.id,
                name: data.collection.name,
                slug: data.collection.slug,
                assetCount: 0,
              },
              ...current.collections,
            ],
          };
        },
      );
      queryClient.setQueryData<CollectionContentsResponse>(
        collectionQueryKeys.contents(workspaceSlug, data.collection.slug),
        {
          collection: {
            id: data.collection.id,
            name: data.collection.name,
            slug: data.collection.slug,
          },
          breadcrumbs: [],
          nodes: [],
        },
      );
    },
  });
}

export function useCreateFolder(workspaceSlug: string, collectionSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ placement, ...data }: CreateFolderMutationInput) => {
      const current = queryClient.getQueryData<CollectionContentsResponse>(
        collectionQueryKeys.contents(
          workspaceSlug,
          collectionSlug,
          data.parentFolderPath,
        ),
      );
      const placeholder: CollectionNode = {
        id: "folder-pending",
        type: "folder",
        name: data.name,
        slug: "pending",
        count: 0,
        folderCount: 0,
        previews: [],
        createdAt: new Date().toISOString(),
        position: null,
      };
      const position = reserveNodePositions(
        current?.nodes ?? [],
        [placeholder],
        placement ?? data.position,
      )[0];
      return createFolder(workspaceSlug, collectionSlug, {
        ...data,
        position,
      });
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<CollectionContentsResponse>(
        collectionQueryKeys.contents(
          workspaceSlug,
          collectionSlug,
          variables.parentFolderPath,
        ),
        (current) => {
          if (
            !current ||
            current.nodes.some((node) => node.id === `folder-${data.folder.id}`)
          ) {
            return current;
          }

          return {
            ...current,
            nodes: [
              ...current.nodes,
              {
                id: `folder-${data.folder.id}`,
                type: "folder",
                name: data.folder.name,
                slug: data.folder.slug,
                count: data.folder.count,
                folderCount: 0,
                previews: data.folder.previews,
                createdAt: data.folder.createdAt,
                position: data.folder.position,
              },
            ],
          };
        },
      );
    },
  });
}

export function useCreateNote(workspaceSlug: string, collectionSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ placement, ...data }: CreateNoteMutationInput) => {
      const current = queryClient.getQueryData<CollectionContentsResponse>(
        collectionQueryKeys.contents(
          workspaceSlug,
          collectionSlug,
          data.parentFolderPath,
        ),
      );
      const placeholder: CollectionNode = {
        id: "note-pending",
        type: "note",
        content: data.content,
        color: data.color ?? null,
        isFavorite: false,
        wordCount: countWords(data.content),
        readingTimeMinutes: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        position: null,
      };
      const position = reserveNodePositions(
        current?.nodes.filter(
          (node) => !node.id.startsWith("note-optimistic-"),
        ) ?? [],
        [placeholder],
        placement ?? data.position,
      )[0];
      return createNote(workspaceSlug, collectionSlug, { ...data, position });
    },
    onMutate: async (variables) => {
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
      );
      await queryClient.cancelQueries({ queryKey: contentsKey });

      const previousContents =
        queryClient.getQueryData<CollectionContentsResponse>(contentsKey);
      const previousCollections = queryClient.getQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
      );
      const previousWorkspace = queryClient.getQueryData<WorkspaceData>([
        "workspace",
        workspaceSlug,
      ]);
      const optimisticId = `note-optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticNote: CollectionNode = {
        id: optimisticId,
        type: "note",
        content: variables.content,
        color: variables.color ?? null,
        isFavorite: false,
        wordCount: 0,
        readingTimeMinutes: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: optimisticId,
        position: null,
      };
      optimisticNote.position =
        reserveNodePositions(
          previousContents?.nodes ?? [],
          [optimisticNote],
          variables.placement ?? variables.position,
        )[0] ?? null;

      queryClient.setQueryData<CollectionContentsResponse>(
        contentsKey,
        (current) => {
          if (!current) return current;

          return {
            ...current,
            nodes: [...current.nodes, optimisticNote],
          };
        },
      );
      updateCollectionAssetCount(queryClient, workspaceSlug, collectionSlug, 1);
      updateFolderAncestorCounts(
        queryClient,
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
        1,
      );

      return {
        contentsKey,
        clientId: optimisticId,
        optimisticId,
        previousContents,
        previousCollections,
        previousWorkspace,
      };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;

      queryClient.setQueryData(context.contentsKey, context.previousContents);
      queryClient.setQueryData(
        collectionQueryKeys.collections(workspaceSlug),
        context.previousCollections,
      );
      queryClient.setQueryData(
        ["workspace", workspaceSlug],
        context.previousWorkspace,
      );
      updateFolderAncestorCounts(
        queryClient,
        workspaceSlug,
        collectionSlug,
        _variables.parentFolderPath,
        -1,
      );
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData<CollectionContentsResponse>(
        collectionQueryKeys.contents(
          workspaceSlug,
          collectionSlug,
          variables.parentFolderPath,
        ),
        (current) => {
          if (!current) {
            return current;
          }

          if (current.nodes.some((node) => node.id === data.note.id)) {
            return {
              ...current,
              nodes: current.nodes.filter(
                (node) => node.id !== context?.optimisticId,
              ),
            };
          }

          return {
            ...current,
            nodes: current.nodes.map((node) =>
              node.id === context?.optimisticId
                ? {
                    ...data.note,
                    clientId: context?.clientId,
                    position: data.note.position ?? node.position,
                  }
                : node,
            ),
          };
        },
      );
      const preview: FolderChildPreview = {
        assetId: data.note.id,
        type: "note",
        color: data.note.color ?? undefined,
        snippet: makeMarkdownPreview(data.note.content),
      };
      addPreviewToCollection(
        queryClient,
        workspaceSlug,
        collectionSlug,
        preview,
      );
      addPreviewToParentFolder(
        queryClient,
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
        preview,
        0,
      );
      reconcileCollectionCaches(queryClient, workspaceSlug, collectionSlug);
    },
  });
}

export function useCreateColor(workspaceSlug: string, collectionSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ placement, ...data }: CreateColorMutationInput) =>
      createColor(workspaceSlug, collectionSlug, {
        ...data,
        position: placement?.position ?? data.position,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["collectionContents", workspaceSlug, collectionSlug],
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
    },
  });
}

export function useInboxContents(
  workspaceSlug: string,
  types?: readonly ContentTypeFilter[],
) {
  return useQuery<InboxContentsResponse>({
    ...inboxContentsQueryOptions(workspaceSlug, types),
    enabled: !!workspaceSlug,
    placeholderData: keepPreviousData,
  });
}

export function useMarkInboxSeen(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markInboxSeen(workspaceSlug),
    onMutate: async () => {
      const workspaceKey = ["workspace", workspaceSlug] as const;
      await queryClient.cancelQueries({ queryKey: workspaceKey });

      const previousWorkspace =
        queryClient.getQueryData<WorkspaceData>(workspaceKey);
      updateInboxUnreadCount(queryClient, workspaceSlug, () => 0);

      return { workspaceKey, previousWorkspace };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.workspaceKey, context.previousWorkspace);
    },
  });
}

export function useCreateInboxNote(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoteInput) => createInboxNote(workspaceSlug, data),
    onMutate: async (variables) => {
      const inboxKey = collectionQueryKeys.inbox(workspaceSlug);
      const workspaceKey = ["workspace", workspaceSlug] as const;
      await queryClient.cancelQueries({ queryKey: inboxKey });

      const previousInbox =
        queryClient.getQueryData<InboxContentsResponse>(inboxKey);
      const previousWorkspace =
        queryClient.getQueryData<WorkspaceData>(workspaceKey);
      const optimisticId = `note-optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticNote = {
        id: optimisticId,
        type: "note" as const,
        content: variables.content,
        color: variables.color ?? null,
        isFavorite: false,
        wordCount: countWords(variables.content),
        readingTimeMinutes: Math.max(
          1,
          Math.ceil(countWords(variables.content) / 200),
        ),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        position: null,
      };

      queryClient.setQueryData<InboxContentsResponse>(inboxKey, (current) => {
        if (!current) {
          return {
            collection: {
              id: 0,
              name: "Inbox",
              slug: "inbox",
            },
            breadcrumbs: [],
            nodes: [optimisticNote],
          };
        }

        return {
          ...current,
          nodes: [optimisticNote, ...current.nodes],
        };
      });
      updateInboxUnreadCount(queryClient, workspaceSlug, (count) => count + 1);

      return {
        inboxKey,
        optimisticId,
        previousInbox,
        workspaceKey,
        previousWorkspace,
      };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.inboxKey, context.previousInbox);
      queryClient.setQueryData(context.workspaceKey, context.previousWorkspace);
    },
    onSuccess: (data, _variables, context) => {
      queryClient.setQueryData<InboxContentsResponse>(
        collectionQueryKeys.inbox(workspaceSlug),
        (current) => {
          if (!current) return current;

          if (current.nodes.some((node) => node.id === data.note.id)) {
            return {
              ...current,
              nodes: current.nodes.filter(
                (node) => node.id !== context?.optimisticId,
              ),
            };
          }

          return {
            ...current,
            nodes: current.nodes.map((node) =>
              node.id === context?.optimisticId ? data.note : node,
            ),
          };
        },
      );
    },
  });
}

export function useCreateInboxColor(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateColorInput) =>
      createInboxColor(workspaceSlug, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.inbox(workspaceSlug),
      });
    },
  });
}

function applyUpdatedNoteToContents(
  current: CollectionContentsResponse | undefined,
  note: UpdatedNote,
): CollectionContentsResponse | undefined {
  if (!current) return current;

  return {
    ...current,
    nodes: current.nodes.map((node) => {
      if (node.type === "note" && node.id === note.id) {
        return { ...node, ...note };
      }

      if (node.type !== "folder") return node;

      return {
        ...node,
        previews: node.previews.map((preview) =>
          preview.type === "note" && preview.assetId === note.id
            ? { ...preview, snippet: makeMarkdownPreview(note.content) }
            : preview,
        ),
      };
    }),
  };
}

export function useUpdateNote(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, ...data }: UpdateNoteInput & { assetId: string }) =>
      updateNote(workspaceSlug, assetId, data),
    onSuccess: ({ note }) => {
      queryClient.setQueriesData<CollectionContentsResponse>(
        {
          predicate: ({ queryKey }) =>
            (queryKey[0] === "collectionContents" ||
              queryKey[0] === "inboxContents") &&
            queryKey[1] === workspaceSlug,
        },
        (current) => applyUpdatedNoteToContents(current, note),
      );
      queryClient.setQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
        (current) =>
          current
            ? {
                collections: current.collections.map((collection) => ({
                  ...collection,
                  previews: collection.previews.map((preview) =>
                    preview.type === "note" && preview.assetId === note.id
                      ? {
                          ...preview,
                          snippet: makeMarkdownPreview(note.content),
                        }
                      : preview,
                  ),
                })),
              }
            : current,
      );
    },
  });
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function useUploadLocalImages(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      files,
      parentFolderPath,
      position,
      placement,
    }: UploadLocalImagesMutationInput) => {
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        parentFolderPath,
      );
      // The local preview is the completion point for this interaction. Do not
      // wait for an in-flight refetch before placing it on the canvas.
      void queryClient.cancelQueries({ queryKey: contentsKey });

      const imageDimensions = await Promise.all(
        files.map(async (file) => {
          try {
            return await readUploadImageDimensions(file);
          } catch {
            return UNKNOWN_IMAGE_DIMENSIONS;
          }
        }),
      );
      const previousContents =
        queryClient.getQueryData<CollectionContentsResponse>(contentsKey);
      const previousCollections = queryClient.getQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
      );
      const previousWorkspace = queryClient.getQueryData<WorkspaceData>([
        "workspace",
        workspaceSlug,
      ]);
      const optimisticImages = files.map((file, index) =>
        makeOptimisticImageNode(file, index, imageDimensions[index]),
      );
      const positions = reserveNodePositions(
        previousContents?.nodes ?? [],
        optimisticImages,
        placement ?? position,
      );
      for (const [index, image] of optimisticImages.entries()) {
        image.position = positions[index] ?? null;
      }

      queryClient.setQueryData<CollectionContentsResponse>(
        contentsKey,
        (current) => {
          if (!current) return current;

          return {
            ...current,
            nodes: [...current.nodes, ...optimisticImages],
          };
        },
      );
      if (optimisticImages.length > 1) {
        const placedImages = optimisticImages.filter(
          (image) => image.position !== null,
        );
        if (placedImages.length === optimisticImages.length) {
          emitBatchPlacementCompleted({
            boardKey: makeBoardKey(
              workspaceSlug,
              collectionSlug,
              parentFolderPath,
            ),
            nodeIds: placedImages.map((image) => image.id),
            bounds: getImageBatchBounds(placedImages),
          });
        }
      }
      updateCollectionAssetCount(
        queryClient,
        workspaceSlug,
        collectionSlug,
        optimisticImages.length,
      );
      updateFolderAncestorCounts(
        queryClient,
        workspaceSlug,
        collectionSlug,
        parentFolderPath,
        optimisticImages.length,
      );

      const images: CollectionImageNode[] = [];
      const multiple = files.length > 1;
      const label = multiple ? `${files.length} images` : "1 image";
      const toastId = toast.loading(`Uploading ${label}...`);

      try {
        for (const [index, file] of files.entries()) {
          const optimisticImage = optimisticImages[index]!;
          const uploadData = await createImageUpload(
            workspaceSlug,
            collectionSlug,
            {
              fileName: file.name || "clipboard-image.png",
              contentType: file.type,
              sizeBytes: file.size,
              width: optimisticImage.width,
              height: optimisticImage.height,
              parentFolderPath,
              position: optimisticImage.position ?? undefined,
            },
          );

          await uploadFileToPresignedUrl(
            file,
            uploadData.upload,
            (progress) => {
              toast.loading(
                React.createElement(
                  React.Fragment,
                  null,
                  file.name,
                  " — ",
                  React.createElement(
                    "span",
                    { className: "font-mono tabular-nums" },
                    `${progress}%`,
                  ),
                  multiple ? ` (${index + 1} of ${files.length})` : "",
                ),
                { id: toastId },
              );
              updateOptimisticImage(
                queryClient,
                workspaceSlug,
                collectionSlug,
                parentFolderPath,
                optimisticImage.id,
                { uploadProgress: progress },
              );
            },
          );

          const image = {
            ...uploadData.upload.image,
            clientId: optimisticImage.clientId,
            position: optimisticImage.position,
            localPreviewUrl: optimisticImage.previewObjectUrl,
          };
          images.push(image);
          queryClient.setQueryData<CollectionContentsResponse>(
            contentsKey,
            (current) =>
              !current
                ? current
                : {
                    ...current,
                    nodes: current.nodes.map((node) =>
                      node.id === optimisticImage.id ? image : node,
                    ),
                  },
          );
          const preview: FolderChildPreview = {
            assetId: image.id,
            type: "image",
            url: image.url,
            blurDataURL: image.blurDataURL,
          };
          addPreviewToCollection(
            queryClient,
            workspaceSlug,
            collectionSlug,
            preview,
          );
          addPreviewToParentFolder(
            queryClient,
            workspaceSlug,
            collectionSlug,
            parentFolderPath,
            preview,
            0,
          );
        }

        // Keep the local Blob preview in the active contents cache until the
        // remote image has decoded in ProgressiveImage. Refetching here would
        // replace it with server data that cannot carry a browser-only URL.
        // Metadata can still refresh without disturbing the visual handoff.
        reconcileCollectionMetadata(queryClient, workspaceSlug);
        toast.success(`${label} uploaded`, { id: toastId });
        return { images, parentFolderPath };
      } catch (error) {
        toast.error("Upload failed", { id: toastId });
        revokeOptimisticImageUrls(optimisticImages);
        queryClient.setQueryData(contentsKey, previousContents);
        queryClient.setQueryData(
          collectionQueryKeys.collections(workspaceSlug),
          previousCollections,
        );
        queryClient.setQueryData(
          ["workspace", workspaceSlug],
          previousWorkspace,
        );
        updateFolderAncestorCounts(
          queryClient,
          workspaceSlug,
          collectionSlug,
          parentFolderPath,
          -optimisticImages.length,
        );
        throw error;
      }
    },
  });
}

function getImageBatchBounds(images: CollectionImageNode[]) {
  return images.reduce(
    (bounds, image) => {
      const position = image.position!;
      const height = BOARD_CARD_WIDTH * (image.height / image.width);
      return {
        left: Math.min(bounds.left, position.x),
        top: Math.min(bounds.top, position.y),
        right: Math.max(bounds.right, position.x + BOARD_CARD_WIDTH),
        bottom: Math.max(bounds.bottom, position.y + height),
      };
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
}

export function useUploadInboxImages(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ files }: { files: File[] }) => {
      const inboxKey = collectionQueryKeys.inbox(workspaceSlug);
      const workspaceKey = ["workspace", workspaceSlug] as const;
      // Keep the modal-to-canvas handoff immediate; cancelling a refetch can
      // happen in parallel with the optimistic cache update.
      void queryClient.cancelQueries({ queryKey: inboxKey });

      const previousInbox =
        queryClient.getQueryData<InboxContentsResponse>(inboxKey);
      const previousWorkspace =
        queryClient.getQueryData<WorkspaceData>(workspaceKey);
      const optimisticImages = files.map((file, index) =>
        makeOptimisticImageNode(file, index),
      );

      queryClient.setQueryData<InboxContentsResponse>(inboxKey, (current) => {
        if (!current) return current;

        return {
          ...current,
          nodes: [...optimisticImages, ...current.nodes],
        };
      });
      updateInboxUnreadCount(
        queryClient,
        workspaceSlug,
        (count) => count + files.length,
      );

      const imageDimensions = await Promise.all(
        files.map(async (file) => {
          try {
            return await readUploadImageDimensions(file);
          } catch {
            return { width: 1, height: 1 };
          }
        }),
      );
      for (const [index, dimensions] of imageDimensions.entries()) {
        const optimisticImage = optimisticImages[index]!;
        optimisticImage.width = dimensions.width;
        optimisticImage.height = dimensions.height;
        updateOptimisticInboxImage(
          queryClient,
          workspaceSlug,
          optimisticImage.id,
          dimensions,
        );
      }

      const images: CollectionImageNode[] = [];
      const multiple = files.length > 1;
      const label = multiple ? `${files.length} images` : "1 image";
      const toastId = toast.loading(`Uploading ${label}...`);

      try {
        for (const [index, file] of files.entries()) {
          const optimisticImage = optimisticImages[index]!;
          const uploadData = await createInboxImageUpload(workspaceSlug, {
            fileName: file.name || "clipboard-image.png",
            contentType: file.type,
            sizeBytes: file.size,
            width: optimisticImage.width,
            height: optimisticImage.height,
          });

          await uploadFileToPresignedUrl(
            file,
            uploadData.upload,
            (progress) => {
              toast.loading(
                React.createElement(
                  React.Fragment,
                  null,
                  file.name,
                  " — ",
                  React.createElement(
                    "span",
                    { className: "font-mono tabular-nums" },
                    `${progress}%`,
                  ),
                  multiple ? ` (${index + 1} of ${files.length})` : "",
                ),
                { id: toastId },
              );
              updateOptimisticInboxImage(
                queryClient,
                workspaceSlug,
                optimisticImage.id,
                { uploadProgress: progress },
              );
            },
          );
          const image = {
            ...uploadData.upload.image,
            clientId: optimisticImage.clientId,
            localPreviewUrl: optimisticImage.previewObjectUrl,
          };
          images.push(image);
          queryClient.setQueryData<InboxContentsResponse>(inboxKey, (current) =>
            !current
              ? current
              : {
                  ...current,
                  nodes: current.nodes.map((node) =>
                    node.id === optimisticImage.id ? image : node,
                  ),
                },
          );
        }

        toast.success(`${label} uploaded`, { id: toastId });
        return { images };
      } catch (error) {
        toast.error("Upload failed", { id: toastId });
        revokeOptimisticImageUrls(optimisticImages);
        queryClient.setQueryData(inboxKey, previousInbox);
        queryClient.setQueryData(workspaceKey, previousWorkspace);
        throw error;
      }
    },
  });
}

export function useCreateRemoteImage(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      placement,
      preview,
      ...data
    }: CreateRemoteImageMutationInput) => {
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        data.parentFolderPath,
      );
      await queryClient.cancelQueries({ queryKey: contentsKey });

      const current =
        queryClient.getQueryData<CollectionContentsResponse>(contentsKey);
      const expectedParentFolderNodeId = data.parentFolderPath
        ? current?.breadcrumbs.at(-1)
          ? `folder-${current.breadcrumbs.at(-1)!.id}`
          : undefined
        : null;
      const optimisticId = `image-importing-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticImage: Extract<CollectionNode, { type: "image" }> = {
        id: optimisticId,
        type: "image",
        // Render the provider/browser URL immediately while the server imports it.
        url: preview?.url ?? data.url,
        localPreviewUrl: preview?.fallbackUrl ?? preview?.url,
        width: preview?.width ?? UNKNOWN_IMAGE_DIMENSIONS.width,
        height: preview?.height ?? UNKNOWN_IMAGE_DIMENSIONS.height,
        title: data.title ?? null,
        alt: data.alt ?? null,
        sourceLabel: null,
        sourceUrl: data.url,
        isFavorite: false,
        uploadStatus: "processing",
        uploadProgress: 100,
        clientId: optimisticId,
        createdAt: new Date().toISOString(),
        position: null,
      };
      const reservedPosition = reserveNodePositions(
        current?.nodes ?? [],
        [optimisticImage],
        placement ?? data.position,
      )[0];
      optimisticImage.position = reservedPosition ?? null;

      queryClient.setQueryData<CollectionContentsResponse>(
        contentsKey,
        (contents) => {
          if (!contents) return contents;

          return {
            ...contents,
            nodes: [...contents.nodes, optimisticImage],
          };
        },
      );

      updateCollectionAssetCount(queryClient, workspaceSlug, collectionSlug, 1);
      updateFolderAncestorCounts(
        queryClient,
        workspaceSlug,
        collectionSlug,
        data.parentFolderPath,
        1,
      );

      if (!preview) {
        void readRemoteImageDimensions(data.url)
          .then((dimensions) => {
            updateOptimisticImage(
              queryClient,
              workspaceSlug,
              collectionSlug,
              data.parentFolderPath,
              optimisticImage.id,
              dimensions,
            );
          })
          .catch(() => undefined);
      }

      try {
        const created = await createRemoteImage(workspaceSlug, collectionSlug, {
          ...data,
          position: optimisticImage.position ?? undefined,
        });
        const image = await waitForProcessedImage(
          () =>
            fetchImageUploadStatus(
              workspaceSlug,
              collectionSlug,
              created.upload.id,
            ),
          created.upload,
        );
        const position = optimisticImage.position ?? image.position;

        if (
          position &&
          (image.position?.x !== position.x ||
            image.position?.y !== position.y) &&
          expectedParentFolderNodeId !== undefined
        ) {
          await updateCollectionNodePosition(
            workspaceSlug,
            collectionSlug,
            image.id,
            { position, expectedParentFolderNodeId },
          );
        }

        const completedImage = {
          ...image,
          clientId: optimisticImage.clientId,
          position,
          // Preserve the already-visible provider preview until the processed
          // image has decoded. This also covers a ReactFlow node remount when
          // the optimistic id is replaced by the persisted image id.
          localPreviewUrl: optimisticImage.localPreviewUrl,
        };
        queryClient.setQueryData<CollectionContentsResponse>(
          contentsKey,
          (contents) => {
            if (!contents) return contents;

            return {
              ...contents,
              nodes: contents.nodes.map((node) =>
                node.id === optimisticImage.id ? completedImage : node,
              ),
            };
          },
        );
        const preview: FolderChildPreview = {
          assetId: completedImage.id,
          type: "image",
          url: completedImage.url,
          blurDataURL: completedImage.blurDataURL,
        };
        addPreviewToCollection(
          queryClient,
          workspaceSlug,
          collectionSlug,
          preview,
        );
        addPreviewToParentFolder(
          queryClient,
          workspaceSlug,
          collectionSlug,
          data.parentFolderPath,
          preview,
          0,
        );
        // Multiple URL imports can finish out of order. Refetching contents here
        // would replace any sibling placeholders that are still processing.
        reconcileCollectionMetadata(queryClient, workspaceSlug);
        return completedImage;
      } catch (error) {
        queryClient.setQueryData<CollectionContentsResponse>(
          contentsKey,
          (contents) => {
            if (!contents) return contents;

            return {
              ...contents,
              nodes: contents.nodes.filter(
                (node) => node.id !== optimisticImage.id,
              ),
            };
          },
        );
        updateCollectionAssetCount(
          queryClient,
          workspaceSlug,
          collectionSlug,
          -1,
        );
        updateFolderAncestorCounts(
          queryClient,
          workspaceSlug,
          collectionSlug,
          data.parentFolderPath,
          -1,
        );
        reconcileCollectionMetadata(queryClient, workspaceSlug);
        throw error;
      }
    },
  });
}

export function useCreateInboxRemoteImage(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      preview: _preview,
      ...data
    }: CreateRemoteImageMutationInput) => {
      const created = await createInboxRemoteImage(workspaceSlug, data);
      return waitForProcessedImage(
        () => fetchInboxImageUploadStatus(workspaceSlug, created.upload.id),
        created.upload,
      );
    },
    onMutate: () => {
      const workspaceKey = ["workspace", workspaceSlug] as const;
      const previousWorkspace =
        queryClient.getQueryData<WorkspaceData>(workspaceKey);
      updateInboxUnreadCount(queryClient, workspaceSlug, (count) => count + 1);

      return { workspaceKey, previousWorkspace };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.workspaceKey, context.previousWorkspace);
    },
    onSuccess: (data) => {
      appendNodeToInboxContents(queryClient, workspaceSlug, data);
    },
  });
}

export function useUpdateCollectionNodePosition(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateNodePositionInput) =>
      updateCollectionNodePosition(workspaceSlug, collectionSlug, data.nodeId, {
        position: data.position,
        expectedParentFolderNodeId: data.expectedParentFolderNodeId,
      }),
    onMutate: async (variables) => {
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        variables.folderPath,
      );
      await queryClient.cancelQueries({ queryKey: contentsKey });
      const previousPosition = queryClient
        .getQueryData<CollectionContentsResponse>(contentsKey)
        ?.nodes.find((node) => node.id === variables.nodeId)?.position;

      queryClient.setQueryData<CollectionContentsResponse>(
        contentsKey,
        (current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.map((node) =>
                  node.id === variables.nodeId
                    ? { ...node, position: variables.position }
                    : node,
                ),
              }
            : current,
      );

      return { contentsKey, previousPosition };
    },
    onError: (_error, variables, context) => {
      if (!context) return;

      queryClient.setQueryData<CollectionContentsResponse>(
        context.contentsKey,
        (current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.map((node) => {
                  if (
                    node.id !== variables.nodeId ||
                    node.position?.x !== variables.position.x ||
                    node.position?.y !== variables.position.y
                  ) {
                    return node;
                  }

                  return {
                    ...node,
                    position: context.previousPosition ?? null,
                  };
                }),
              }
            : current,
      );
      toast.error("Unable to save the new card position.");
    },
  });
}

export function useUpdateCollectionNodePositions(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateNodePositionsInput) =>
      updateCollectionNodePositions(workspaceSlug, collectionSlug, data),
    onMutate: async (variables) => {
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        variables.folderPath,
      );
      await queryClient.cancelQueries({ queryKey: contentsKey });
      const previousNodes =
        queryClient.getQueryData<CollectionContentsResponse>(
          contentsKey,
        )?.nodes;
      const positions = new Map(
        variables.positions.map(({ nodeId, position }) => [nodeId, position]),
      );

      queryClient.setQueryData<CollectionContentsResponse>(
        contentsKey,
        (current) =>
          current
            ? {
                ...current,
                nodes: current.nodes.map((node) => {
                  const position = positions.get(node.id);
                  return position ? { ...node, position } : node;
                }),
              }
            : current,
      );

      return { contentsKey, previousNodes };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousNodes) return;
      const previousNodes = context.previousNodes;
      queryClient.setQueryData<CollectionContentsResponse>(
        context.contentsKey,
        (current) => (current ? { ...current, nodes: previousNodes } : current),
      );
    },
  });
}

export function useDeleteAsset(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => deleteAsset(workspaceSlug, assetId),
    onMutate: async (assetId) => {
      const contentsKey = ["collectionContents", workspaceSlug] as const;
      const inboxKey = collectionQueryKeys.inbox(workspaceSlug);
      const collectionsKey = collectionQueryKeys.collections(workspaceSlug);
      const workspaceKey = ["workspace", workspaceSlug] as const;

      await queryClient.cancelQueries({ queryKey: inboxKey });
      await queryClient.cancelQueries({ queryKey: contentsKey });

      const previousInbox =
        queryClient.getQueryData<InboxContentsResponse>(inboxKey);
      const previousContentsMap = new Map(
        queryClient
          .getQueriesData<CollectionContentsResponse>({ queryKey: contentsKey })
          .filter(([, data]) => data != null),
      );
      const previousCollections =
        queryClient.getQueryData<CollectionsData>(collectionsKey);
      const previousWorkspace =
        queryClient.getQueryData<WorkspaceData>(workspaceKey);

      const affectedCollectionSlugs = new Set<string>();
      const removedLocations: Array<{
        collectionSlug: string;
        folderPath: string | undefined;
      }> = [];

      for (const [key, data] of previousContentsMap) {
        if (!data) continue;
        if (!data.nodes.some((node) => node.id === assetId)) continue;

        const [, , collectionSlug, folderPath] = key as [
          string,
          string,
          string,
          string | undefined,
        ];
        affectedCollectionSlugs.add(collectionSlug);
        removedLocations.push({ collectionSlug, folderPath });
      }

      queryClient.setQueryData<InboxContentsResponse>(inboxKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          nodes: current.nodes.filter((node) => node.id !== assetId),
        };
      });

      queryClient.setQueriesData<CollectionContentsResponse>(
        { queryKey: contentsKey },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            nodes: current.nodes.filter((node) => node.id !== assetId),
          };
        },
      );

      for (const slug of affectedCollectionSlugs) {
        updateCollectionAssetCount(queryClient, workspaceSlug, slug, -1);
        removePreviewFromCollection(queryClient, workspaceSlug, slug, assetId);
      }
      for (const location of removedLocations) {
        removePreviewFromParentFolder(
          queryClient,
          workspaceSlug,
          location.collectionSlug,
          location.folderPath,
          assetId,
        );
      }

      return {
        contentsKey,
        inboxKey,
        collectionsKey,
        workspaceKey,
        previousInbox,
        previousContentsMap,
        previousCollections,
        previousWorkspace,
        affectedCollectionSlugs,
        removedLocations,
      };
    },
    onError: (_error, _assetId, context) => {
      if (!context) return;

      queryClient.setQueryData(context.inboxKey, context.previousInbox);
      for (const [key, data] of context.previousContentsMap) {
        queryClient.setQueryData(key, data);
      }
      queryClient.setQueryData(
        context.collectionsKey,
        context.previousCollections,
      );
      queryClient.setQueryData(context.workspaceKey, context.previousWorkspace);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["collectionContents", workspaceSlug],
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceSlug],
      });
    },
  });
}

export function useDeleteCollectionNode(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nodeId: string) =>
      deleteCollectionNode(workspaceSlug, collectionSlug, nodeId),
    onMutate: async (nodeId) => {
      const contentsScope = collectionQueryKeys.contentScope(
        workspaceSlug,
        collectionSlug,
      );
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        folderPath,
      );
      await queryClient.cancelQueries({ queryKey: contentsScope });

      const previousContentsMap = new Map(
        queryClient
          .getQueriesData<CollectionContentsResponse>({
            queryKey: contentsScope,
          })
          .filter(([, data]) => data != null),
      );
      const previousCollections = queryClient.getQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
      );
      const previousWorkspace = queryClient.getQueryData<WorkspaceData>([
        "workspace",
        workspaceSlug,
      ]);
      let removedNode: CollectionNode | undefined;

      queryClient.setQueryData<CollectionContentsResponse>(
        contentsKey,
        (current) => {
          if (!current) return current;

          removedNode = current.nodes.find((node) => node.id === nodeId);
          return {
            ...current,
            nodes: current.nodes.filter((node) => node.id !== nodeId),
          };
        },
      );

      const optimisticDeletedAssetCount = removedNode
        ? removedNode.type === "folder"
          ? removedNode.count
          : 1
        : 0;
      updateCollectionAssetCount(
        queryClient,
        workspaceSlug,
        collectionSlug,
        -optimisticDeletedAssetCount,
      );
      if (removedNode?.type === "folder") {
        updateFolderAncestorCounts(
          queryClient,
          workspaceSlug,
          collectionSlug,
          folderPath,
          -optimisticDeletedAssetCount,
        );
      } else if (optimisticDeletedAssetCount > 0) {
        removePreviewFromCollection(
          queryClient,
          workspaceSlug,
          collectionSlug,
          nodeId,
        );
        removePreviewFromParentFolder(
          queryClient,
          workspaceSlug,
          collectionSlug,
          folderPath,
          nodeId,
        );
      }

      return {
        contentsKey,
        optimisticDeletedAssetCount,
        previousContentsMap,
        previousCollections,
        previousWorkspace,
      };
    },
    onError: (_error, _nodeId, context) => {
      if (!context) return;

      for (const [key, data] of context.previousContentsMap) {
        queryClient.setQueryData(key, data);
      }
      queryClient.setQueryData(
        collectionQueryKeys.collections(workspaceSlug),
        context.previousCollections,
      );
      queryClient.setQueryData(
        ["workspace", workspaceSlug],
        context.previousWorkspace,
      );
    },
    onSuccess: (data, _nodeId, context) => {
      const remainingDeletedAssets =
        data.deletedAssetCount - (context?.optimisticDeletedAssetCount ?? 0);
      updateCollectionAssetCount(
        queryClient,
        workspaceSlug,
        collectionSlug,
        -remainingDeletedAssets,
      );
      if (data.deletedAssetCount > 0) {
        void queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.inbox(workspaceSlug),
        });
      }
      reconcileCollectionCaches(queryClient, workspaceSlug, collectionSlug);
    },
  });
}

export function useDeleteCollection(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (collectionSlug: string) =>
      deleteCollection(workspaceSlug, collectionSlug),
    onError: () => {
      toast.error("Failed to delete collection");
    },
    onSuccess: (data, collectionSlug) => {
      queryClient.setQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
        (current) =>
          current
            ? {
                collections: current.collections.filter(
                  (collection) => collection.slug !== collectionSlug,
                ),
              }
            : current,
      );
      queryClient.setQueryData<WorkspaceData>(
        ["workspace", workspaceSlug],
        (current) =>
          current
            ? {
                ...current,
                collections: current.collections.filter(
                  (collection) => collection.slug !== collectionSlug,
                ),
              }
            : current,
      );
      queryClient.removeQueries({
        queryKey: collectionQueryKeys.contents(
          workspaceSlug,
          data.deletedCollectionSlug,
        ),
      });
    },
  });
}

export function useFlattenFolder(
  workspaceSlug: string,
  collectionSlug: string,
) {
  const queryClient = useQueryClient();

  const setFlattenStatus = (nodeId: string, status: "pending" | undefined) => {
    queryClient.setQueriesData<CollectionContentsResponse>(
      {
        queryKey: collectionQueryKeys.contentScope(
          workspaceSlug,
          collectionSlug,
        ),
      },
      (current) => {
        if (!current || !current.nodes.some((node) => node.id === nodeId)) {
          return current;
        }
        return {
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === nodeId ? { ...node, flattenStatus: status } : node,
          ),
        };
      },
    );
  };

  return useMutation({
    mutationFn: (nodeId: string) =>
      flattenFolder(workspaceSlug, collectionSlug, nodeId),
    onMutate: (nodeId) => setFlattenStatus(nodeId, "pending"),
    onSuccess: () => {
      reconcileCollectionCaches(queryClient, workspaceSlug, collectionSlug);
    },
    onSettled: (_data, error, nodeId) => {
      // On success the reconcile refetch already removed/rewrote the folder;
      // on error clear the marker so the folder renders normally again.
      if (error) setFlattenStatus(nodeId, undefined);
    },
  });
}

export function useBulkDelete(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      nodeIds,
      collectionSlug,
    }: {
      nodeIds: string[];
      collectionSlug?: string;
    }) => bulkDeleteNodes(workspaceSlug, nodeIds, collectionSlug),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["collectionContents", workspaceSlug],
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.inbox(workspaceSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: ["workspace", workspaceSlug],
      });
    },
  });
}

export function useCollectionContents(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
  options?: {
    enabled?: boolean;
    types?: readonly ContentTypeFilter[];
  },
) {
  const types = options?.types ? [...options.types].sort() : undefined;
  return useQuery<CollectionContentsResponse>({
    ...collectionContentsQueryOptions(
      workspaceSlug,
      collectionSlug,
      folderPath,
      types,
    ),
    enabled: (options?.enabled ?? true) && !!workspaceSlug && !!collectionSlug,
    placeholderData: keepPreviousData,
  });
}
