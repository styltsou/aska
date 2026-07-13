import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCollections,
  createCollection,
  createInboxImageUpload,
  createInboxNote,
  createInboxRemoteImage,
  createFolder,
  createImageUpload,
  createNote,
  createRemoteImage,
  fetchImageUploadStatus,
  fetchInboxImageUploadStatus,
  deleteAsset,
  deleteCollectionNode,
  fetchCollectionContents,
  fetchInboxContents,
  placeAsset,
} from "./fetchers";
import type {
  CollectionContentsResponse,
  CollectionImageNode,
  CollectionNode,
  CollectionsData,
  CreateCollectionInput,
  CreateImageUploadResponse,
  CreateFolderInput,
  CreateRemoteImageInput,
  CreateNoteInput,
  FolderChildPreview,
  ImageUploadStatus,
  InboxContentsResponse,
  PlaceAssetInput,
} from "./types";
import type { WorkspaceData } from "@/api/workspace";

const COLLECTIONS_STALE_TIME = 60_000;
const COLLECTION_CONTENTS_STALE_TIME = 30_000;
const MAX_COLLECTION_PREVIEWS = 4;
const UPLOAD_POLL_INTERVAL_MS = 1_000;
const UPLOAD_POLL_TIMEOUT_MS = 2 * 60 * 1_000;

export const collectionQueryKeys = {
  collections: (workspaceSlug: string) =>
    ["collections", workspaceSlug] as const,
  contents: (
    workspaceSlug: string,
    collectionSlug: string,
    folderPath?: string,
  ) =>
    ["collectionContents", workspaceSlug, collectionSlug, folderPath] as const,
  inbox: (workspaceSlug: string) => ["inboxContents", workspaceSlug] as const,
};

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

function appendImageToCollectionContents(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  collectionSlug: string,
  folderPath: string | undefined,
  image: Extract<CollectionNode, { type: "image" }>,
  countDelta = 1,
) {
  queryClient.setQueryData<CollectionContentsResponse>(
    collectionQueryKeys.contents(workspaceSlug, collectionSlug, folderPath),
    (current) => {
      if (!current || current.nodes.some((node) => node.id === image.id)) {
        return current;
      }

      return {
        ...current,
        nodes: [...current.nodes, image],
      };
    },
  );
  updateCollectionAssetCount(
    queryClient,
    workspaceSlug,
    collectionSlug,
    countDelta,
  );
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

async function readImageDimensions(file: File): Promise<{
  width: number;
  height: number;
}> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function makeOptimisticImageNode(
  file: File,
  index: number,
): Promise<
  Extract<CollectionNode, { type: "image" }> & {
    previewObjectUrl: string;
  }
> {
  const previewObjectUrl = URL.createObjectURL(file);
  const id = `image-uploading-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
  let dimensions: { width: number; height: number };

  try {
    dimensions = await readImageDimensions(file);
  } catch {
    // Keep the upload usable if the browser cannot decode a local preview.
    dimensions = { width: 1, height: 1 };
  }

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

function revokeOptimisticImageUrlsLater(
  images: Array<{ previewObjectUrl?: string }> | undefined,
) {
  window.setTimeout(() => revokeOptimisticImageUrls(images), 30_000);
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
    queryKey: collectionQueryKeys.collections(workspaceSlug),
    queryFn: () => fetchCollections(workspaceSlug),
    enabled: !!workspaceSlug,
    staleTime: COLLECTIONS_STALE_TIME,
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
              ...current.collections,
              {
                ...data.collection,
                assetCount: 0,
                previews: [],
              },
            ].sort((a, b) => a.name.localeCompare(b.name)),
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
              ...current.collections,
              {
                id: data.collection.id,
                name: data.collection.name,
                slug: data.collection.slug,
                assetCount: 0,
              },
            ].sort((a, b) => a.name.localeCompare(b.name)),
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
    mutationFn: (data: CreateFolderInput) =>
      createFolder(workspaceSlug, collectionSlug, data),
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
                previews: data.folder.previews,
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
    mutationFn: (data: CreateNoteInput) =>
      createNote(workspaceSlug, collectionSlug, data),
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

      queryClient.setQueryData<CollectionContentsResponse>(
        contentsKey,
        (current) => {
          if (!current) return current;

          return {
            ...current,
            nodes: [
              ...current.nodes,
              {
                id: optimisticId,
                type: "note",
                content: variables.content,
                color: variables.color ?? null,
                isFavorite: false,
                wordCount: 0,
                readingTimeMinutes: 1,
              },
            ],
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
              node.id === context?.optimisticId ? data.note : node,
            ),
          };
        },
      );
      const preview: FolderChildPreview = {
        assetId: data.note.id,
        type: "note",
        color: data.note.color ?? undefined,
        snippet: data.note.content.slice(0, 100),
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
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.contents(workspaceSlug, collectionSlug),
      });
    },
  });
}

export function useInboxContents(workspaceSlug: string) {
  return useQuery<InboxContentsResponse>({
    queryKey: collectionQueryKeys.inbox(workspaceSlug),
    queryFn: () => fetchInboxContents(workspaceSlug),
    enabled: !!workspaceSlug,
    staleTime: COLLECTION_CONTENTS_STALE_TIME,
  });
}

export function useCreateInboxNote(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoteInput) => createInboxNote(workspaceSlug, data),
    onMutate: async (variables) => {
      const inboxKey = collectionQueryKeys.inbox(workspaceSlug);
      await queryClient.cancelQueries({ queryKey: inboxKey });

      const previousInbox =
        queryClient.getQueryData<InboxContentsResponse>(inboxKey);
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

      return { inboxKey, optimisticId, previousInbox };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.inboxKey, context.previousInbox);
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
    }: {
      files: File[];
      parentFolderPath?: string;
    }) => {
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        parentFolderPath,
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
      const optimisticImages = await Promise.all(
        files.map(makeOptimisticImageNode),
      );

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

      const processingImages: Promise<CollectionImageNode>[] = [];
      const multiple = files.length > 1;
      const label = multiple ? `${files.length} images` : "1 image";
      const toastId = toast.loading(`Uploading ${label}...`);
      let cancelled = false;

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
              parentFolderPath,
            },
          );

          await uploadFileToPresignedUrl(
            file,
            uploadData.upload,
            (progress) => {
              toast.loading(
                `${file.name} — ${progress}%${multiple ? ` (${index + 1} of ${files.length})` : ""}`,
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

          updateOptimisticImage(
            queryClient,
            workspaceSlug,
            collectionSlug,
            parentFolderPath,
            optimisticImage.id,
            { uploadStatus: "processing", uploadProgress: 100 },
          );

          processingImages.push(
            waitForProcessedImage(() =>
              fetchImageUploadStatus(
                workspaceSlug,
                collectionSlug,
                uploadData.upload.id,
              ),
            ).then((processedImage) => {
              const image = {
                ...processedImage,
                clientId: optimisticImage.clientId,
              };

              if (cancelled) return image;

              queryClient.setQueryData<CollectionContentsResponse>(
                contentsKey,
                (current) => {
                  if (!current) return current;

                  return {
                    ...current,
                    nodes: current.nodes.map((node) =>
                      node.id === optimisticImage.id ? image : node,
                    ),
                  };
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
              return image;
            }),
          );
        }

        const images = await Promise.all(processingImages);

        revokeOptimisticImageUrlsLater(optimisticImages);
        void queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.collections(workspaceSlug),
        });
        void queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.contents(workspaceSlug, collectionSlug),
        });
        toast.success(`${label} uploaded`, { id: toastId });
        return { images, parentFolderPath };
      } catch (error) {
        cancelled = true;
        void Promise.allSettled(processingImages);
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

export function useUploadInboxImages(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ files }: { files: File[] }) => {
      const inboxKey = collectionQueryKeys.inbox(workspaceSlug);
      await queryClient.cancelQueries({ queryKey: inboxKey });

      const previousInbox =
        queryClient.getQueryData<InboxContentsResponse>(inboxKey);
      const optimisticImages = await Promise.all(
        files.map(makeOptimisticImageNode),
      );

      queryClient.setQueryData<InboxContentsResponse>(inboxKey, (current) => {
        if (!current) return current;

        return {
          ...current,
          nodes: [...optimisticImages, ...current.nodes],
        };
      });

      const processingImages: Promise<CollectionImageNode>[] = [];
      const multiple = files.length > 1;
      const label = multiple ? `${files.length} images` : "1 image";
      const toastId = toast.loading(`Uploading ${label}...`);
      let cancelled = false;

      try {
        for (const [index, file] of files.entries()) {
          const optimisticImage = optimisticImages[index]!;
          const uploadData = await createInboxImageUpload(workspaceSlug, {
            fileName: file.name || "clipboard-image.png",
            contentType: file.type,
            sizeBytes: file.size,
          });

          await uploadFileToPresignedUrl(
            file,
            uploadData.upload,
            (progress) => {
              toast.loading(
                `${file.name} — ${progress}%${multiple ? ` (${index + 1} of ${files.length})` : ""}`,
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
          updateOptimisticInboxImage(
            queryClient,
            workspaceSlug,
            optimisticImage.id,
            { uploadStatus: "processing", uploadProgress: 100 },
          );

          processingImages.push(
            waitForProcessedImage(() =>
              fetchInboxImageUploadStatus(workspaceSlug, uploadData.upload.id),
            ).then((processedImage) => {
              const image = {
                ...processedImage,
                clientId: optimisticImage.clientId,
              };

              if (cancelled) return image;

              queryClient.setQueryData<InboxContentsResponse>(
                inboxKey,
                (current) => {
                  if (!current) return current;

                  return {
                    ...current,
                    nodes: current.nodes.map((node) =>
                      node.id === optimisticImage.id ? image : node,
                    ),
                  };
                },
              );
              return image;
            }),
          );
        }

        const images = await Promise.all(processingImages);

        toast.success(`${label} uploaded`, { id: toastId });
        revokeOptimisticImageUrlsLater(optimisticImages);
        return { images };
      } catch (error) {
        cancelled = true;
        void Promise.allSettled(processingImages);
        toast.error("Upload failed", { id: toastId });
        revokeOptimisticImageUrls(optimisticImages);
        queryClient.setQueryData(inboxKey, previousInbox);
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
    mutationFn: async (data: CreateRemoteImageInput) => {
      const created = await createRemoteImage(
        workspaceSlug,
        collectionSlug,
        data,
      );
      return waitForProcessedImage(
        () =>
          fetchImageUploadStatus(
            workspaceSlug,
            collectionSlug,
            created.upload.id,
          ),
        created.upload,
      );
    },
    onMutate: async (variables) => {
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
      );
      await queryClient.cancelQueries({ queryKey: contentsKey });

      const previousCollections = queryClient.getQueryData<CollectionsData>(
        collectionQueryKeys.collections(workspaceSlug),
      );
      const previousWorkspace = queryClient.getQueryData<WorkspaceData>([
        "workspace",
        workspaceSlug,
      ]);

      updateCollectionAssetCount(queryClient, workspaceSlug, collectionSlug, 1);
      updateFolderAncestorCounts(
        queryClient,
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
        1,
      );

      return { previousCollections, previousWorkspace };
    },
    onError: (_error, variables, context) => {
      if (!context) return;

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
        variables.parentFolderPath,
        -1,
      );
    },
    onSuccess: (data, variables) => {
      appendImageToCollectionContents(
        queryClient,
        workspaceSlug,
        collectionSlug,
        variables.parentFolderPath,
        data,
        0,
      );
      const preview: FolderChildPreview = {
        assetId: data.id,
        type: "image",
        url: data.url,
        blurDataURL: data.blurDataURL,
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
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.contents(workspaceSlug, collectionSlug),
      });
    },
  });
}

export function useCreateInboxRemoteImage(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRemoteImageInput) => {
      const created = await createInboxRemoteImage(workspaceSlug, data);
      return waitForProcessedImage(
        () => fetchInboxImageUploadStatus(workspaceSlug, created.upload.id),
        created.upload,
      );
    },
    onSuccess: (data) => {
      appendNodeToInboxContents(queryClient, workspaceSlug, data);
    },
  });
}

export function usePlaceAsset(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assetId, ...data }: PlaceAssetInput & { assetId: string }) =>
      placeAsset(workspaceSlug, assetId, data),
    onMutate: async (variables) => {
      const inboxKey = collectionQueryKeys.inbox(workspaceSlug);
      const collectionsKey = collectionQueryKeys.collections(workspaceSlug);
      const workspaceKey = ["workspace", workspaceSlug] as const;
      const parentKey = collectionQueryKeys.contents(
        workspaceSlug,
        variables.collectionSlug,
        variables.parentFolderPath,
      );
      await queryClient.cancelQueries({ queryKey: inboxKey });

      const previousInbox =
        queryClient.getQueryData<InboxContentsResponse>(inboxKey);
      const previousCollections =
        queryClient.getQueryData<CollectionsData>(collectionsKey);
      const previousWorkspace =
        queryClient.getQueryData<WorkspaceData>(workspaceKey);
      const previousParent =
        queryClient.getQueryData<CollectionContentsResponse>(parentKey);
      const node = previousInbox?.nodes.find(
        (item) => item.id === variables.assetId,
      );

      if (!node || node.type === "folder") {
        return {
          inboxKey,
          collectionsKey,
          workspaceKey,
          parentKey,
          previousInbox,
          previousCollections,
          previousWorkspace,
          previousParent,
          optimistic: false,
        };
      }

      const preview: FolderChildPreview =
        node.type === "image"
          ? {
              assetId: node.id,
              type: "image",
              url: node.url,
              blurDataURL: node.blurDataURL,
            }
          : {
              assetId: node.id,
              type: "note",
              color: node.color ?? undefined,
              snippet: node.content.slice(0, 100),
            };

      queryClient.setQueryData<InboxContentsResponse>(inboxKey, (current) =>
        current
          ? {
              ...current,
              nodes: current.nodes.filter(
                (item) => item.id !== variables.assetId,
              ),
            }
          : current,
      );
      updateCollectionAssetCount(
        queryClient,
        workspaceSlug,
        variables.collectionSlug,
        1,
      );
      addPreviewToCollection(
        queryClient,
        workspaceSlug,
        variables.collectionSlug,
        preview,
      );
      addPreviewToParentFolder(
        queryClient,
        workspaceSlug,
        variables.collectionSlug,
        variables.parentFolderPath,
        preview,
      );

      return {
        inboxKey,
        collectionsKey,
        workspaceKey,
        parentKey,
        previousInbox,
        previousCollections,
        previousWorkspace,
        previousParent,
        optimistic: true,
      };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.inboxKey, context.previousInbox);
      queryClient.setQueryData(
        context.collectionsKey,
        context.previousCollections,
      );
      queryClient.setQueryData(context.workspaceKey, context.previousWorkspace);
      queryClient.setQueryData(context.parentKey, context.previousParent);
    },
    onSuccess: (data, variables, context) => {
      if (context?.optimistic) {
        void queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.contents(
            workspaceSlug,
            variables.collectionSlug,
            variables.parentFolderPath,
          ),
        });
        void queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.collections(workspaceSlug),
        });
        return;
      }
      queryClient.setQueryData<InboxContentsResponse>(
        collectionQueryKeys.inbox(workspaceSlug),
        (current) => {
          if (!current) return current;

          return {
            ...current,
            nodes: current.nodes.filter(
              (node) => node.id !== variables.assetId,
            ),
          };
        },
      );
      updateCollectionAssetCount(
        queryClient,
        workspaceSlug,
        variables.collectionSlug,
        1,
      );

      const preview =
        data.node.type === "image"
          ? ({
              assetId: data.node.id,
              type: "image",
              url: data.node.url,
              blurDataURL: data.node.blurDataURL,
            } as FolderChildPreview)
          : data.node.type === "note"
            ? ({
                assetId: data.node.id,
                type: "note",
                color: data.node.color ?? undefined,
                snippet: data.node.content.slice(0, 100),
              } as FolderChildPreview)
            : null;
      if (preview) {
        addPreviewToCollection(
          queryClient,
          workspaceSlug,
          variables.collectionSlug,
          preview,
        );
        addPreviewToParentFolder(
          queryClient,
          workspaceSlug,
          variables.collectionSlug,
          variables.parentFolderPath,
          preview,
        );
      }

      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.contents(
          workspaceSlug,
          variables.collectionSlug,
          variables.parentFolderPath,
        ),
      });
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
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
      const contentsKey = collectionQueryKeys.contents(
        workspaceSlug,
        collectionSlug,
        folderPath,
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
        previousContents,
        previousCollections,
        previousWorkspace,
      };
    },
    onError: (_error, _nodeId, context) => {
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
      void queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.collections(workspaceSlug),
      });
    },
  });
}

export function useCollectionContents(
  workspaceSlug: string,
  collectionSlug: string,
  folderPath?: string,
  options?: { enabled?: boolean },
) {
  return useQuery<CollectionContentsResponse>({
    queryKey: collectionQueryKeys.contents(
      workspaceSlug,
      collectionSlug,
      folderPath,
    ),
    queryFn: () =>
      fetchCollectionContents(workspaceSlug, collectionSlug, folderPath),
    enabled: (options?.enabled ?? true) && !!workspaceSlug && !!collectionSlug,
    staleTime: COLLECTION_CONTENTS_STALE_TIME,
  });
}
