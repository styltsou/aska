import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useVideoAssets } from "@/api/video";
import { resolveMediaUrl } from "@/api/media";

import {
  useCreateInboxNote,
  useCreateColor,
  useCreateInboxColor,
  useCreateInboxRemoteImage,
  useCreateNote,
  useCreateRemoteImage,
  useUploadInboxImages,
  useUploadLocalImages,
} from "@/api/collection";
import { useCreateInboxLink, useCreateLink } from "@/api/url-unfurl";
import type { BoardInsertionPlacement } from "@/api/collection";
import type { CollectionContentsResponse } from "@/api/collection";
import { collectionQueryKeys } from "@/api/collection/query-keys";
import type { PexelsPhoto } from "@/api/pexels";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import {
  isUploadableMediaFile,
  localMediaKind,
  reserveLocalMediaPositions,
} from "@/lib/media-upload";
import type { ClipboardAssetPayload } from "@/lib/clipboard";
import { toPexelsRemoteImageInput } from "@/lib/pexels-import";
import {
  resolveUrlAsset,
  toResolvedRemoteImageInput,
} from "@/lib/url-asset-kind";
import { parseHttpUrl } from "@/lib/utils";
import {
  isNoteContentTooLong,
  NOTE_CONTENT_LIMIT_MESSAGE,
} from "@/lib/note-content";
import { extractPastedNoteTitle } from "@/lib/note-title";

export type BoardAssetTarget = "collection" | "inbox";

export function useBoardAssetActions({
  workspaceSlug,
  collectionPath,
  target = "collection",
  placement,
  getPlacement,
}: {
  workspaceSlug: string;
  collectionPath: string;
  target?: BoardAssetTarget;
  placement?: BoardInsertionPlacement;
  getPlacement?: () => BoardInsertionPlacement | undefined;
}) {
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const queryClient = useQueryClient();
  const createNote = useCreateNote(workspaceSlug, collectionSlug);
  const uploadLocalImages = useUploadLocalImages(workspaceSlug, collectionSlug);
  const createRemoteImage = useCreateRemoteImage(workspaceSlug, collectionSlug);
  const createInboxNote = useCreateInboxNote(workspaceSlug);
  const createColor = useCreateColor(workspaceSlug, collectionSlug);
  const createInboxColor = useCreateInboxColor(workspaceSlug);
  const uploadInboxImages = useUploadInboxImages(workspaceSlug);
  const createInboxRemoteImage = useCreateInboxRemoteImage(workspaceSlug);
  const createLink = useCreateLink(workspaceSlug, collectionSlug);
  const createInboxLink = useCreateInboxLink(workspaceSlug);
  const videos = useVideoAssets({
    workspaceSlug,
    collectionSlug: target === "collection" ? collectionSlug : undefined,
    parentFolderPath: target === "collection" ? parentFolderPath : undefined,
  });

  const isPending =
    createNote.isPending ||
    uploadLocalImages.isPending ||
    createRemoteImage.isPending ||
    createInboxNote.isPending ||
    uploadInboxImages.isPending ||
    createInboxRemoteImage.isPending ||
    createLink.isPending ||
    createInboxLink.isPending ||
    createColor.isPending ||
    createInboxColor.isPending ||
    videos.upload.isPending ||
    videos.importUrl.isPending;

  const statusText = useMemo(() => {
    if (uploadLocalImages.isPending) return "Uploading images";
    if (createNote.isPending) return "Creating note";
    if (createRemoteImage.isPending) return "Importing image";
    if (createInboxNote.isPending) return "Creating note";
    if (uploadInboxImages.isPending) return "Uploading images";
    if (videos.upload.isPending) return "Uploading video";
    if (videos.importUrl.isPending) return "Importing video";
    if (createInboxRemoteImage.isPending) return "Importing image";
    if (createLink.isPending || createInboxLink.isPending) return "Adding link";
    if (createColor.isPending || createInboxColor.isPending)
      return "Creating color";
    return null;
  }, [
    createInboxNote.isPending,
    createInboxRemoteImage.isPending,
    createInboxLink.isPending,
    createNote.isPending,
    createRemoteImage.isPending,
    createLink.isPending,
    createColor.isPending,
    createInboxColor.isPending,
    uploadInboxImages.isPending,
    uploadLocalImages.isPending,
    videos.upload.isPending,
    videos.importUrl.isPending,
  ]);

  const uploadFiles = useCallback(
    async (files: File[], actionPlacement?: BoardInsertionPlacement) => {
      const mediaFiles = files.filter(isUploadableMediaFile);
      if (mediaFiles.length !== files.length) {
        toast.error(
          "Some files were skipped. Use images up to 20 MB or MP4/WebM videos up to 250 MB.",
        );
      }
      if (mediaFiles.length === 0) return;

      try {
        const insertionPlacement =
          actionPlacement ?? getPlacement?.() ?? placement;
        const existing =
          target === "collection"
            ? queryClient.getQueryData<CollectionContentsResponse>(
                collectionQueryKeys.contents(
                  workspaceSlug,
                  collectionSlug,
                  parentFolderPath,
                ),
              )
            : undefined;
        const positions =
          target === "collection"
            ? await reserveLocalMediaPositions(
                mediaFiles,
                existing?.nodes ?? [],
                insertionPlacement,
              )
            : [];
        const images = mediaFiles.flatMap((file, index) =>
          localMediaKind(file) === "image"
            ? [{ file, position: positions[index] }]
            : [],
        );
        const videoFiles = mediaFiles.flatMap((file, index) =>
          localMediaKind(file) === "video"
            ? [{ file, position: positions[index] }]
            : [],
        );
        const imageGroups =
          videoFiles.length > 0 ? images.map((image) => [image]) : [images];
        for (const group of imageGroups) {
          if (group.length === 0) continue;
          try {
            if (target === "inbox") {
              await uploadInboxImages.mutateAsync({
                files: group.map(({ file }) => file),
              });
            } else {
              await uploadLocalImages.mutateAsync({
                files: group.map(({ file }) => file),
                parentFolderPath,
                placement: insertionPlacement,
                positions: group.map(({ position }) => position!),
              });
            }
          } catch {
            // The image mutation reports its failure; later media still upload.
          }
        }
        for (const { file, position } of videoFiles) {
          try {
            await videos.upload.mutateAsync({ file, position });
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Unable to upload video.",
            );
          }
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Unable to upload media.",
        );
      }
    },
    [
      getPlacement,
      parentFolderPath,
      placement,
      queryClient,
      target,
      uploadInboxImages,
      uploadLocalImages,
      videos.upload,
      workspaceSlug,
      collectionSlug,
    ],
  );

  const createLinkFromUrl = useCallback(
    async (value: string, actionPlacement?: BoardInsertionPlacement) => {
      const url = parseHttpUrl(value);
      if (!url) return;
      const insertionPlacement =
        actionPlacement ?? getPlacement?.() ?? placement;
      const resolved = await resolveUrlAsset(url, (candidate) =>
        resolveMediaUrl(workspaceSlug, candidate),
      );

      if (resolved.kind === "video") {
        try {
          await videos.importUrl.mutateAsync({
            url: resolved.url,
            position: insertionPlacement?.position,
          });
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Unable to import video.",
          );
        }
        return;
      }

      if (resolved.kind === "image") {
        try {
          const image = toResolvedRemoteImageInput(url, resolved);
          if (target === "inbox") {
            await createInboxRemoteImage.mutateAsync(image);
          } else {
            await createRemoteImage.mutateAsync({
              ...image,
              parentFolderPath,
              placement: insertionPlacement,
            });
          }
          toast.success("Image imported");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Unable to import image.",
          );
        }
        return;
      }

      try {
        if (target === "inbox") {
          await createInboxLink.mutateAsync({
            url,
          });
        } else {
          await createLink.mutateAsync({
            url,
            parentFolderPath,
            placement: insertionPlacement,
          });
        }
        toast.success("Link added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unable to add link.");
      }
    },
    [
      createInboxLink,
      createInboxRemoteImage,
      createLink,
      createRemoteImage,
      getPlacement,
      parentFolderPath,
      placement,
      target,
      videos.importUrl,
      workspaceSlug,
    ],
  );

  const importPexelsPhotos = useCallback(
    async (
      photos: readonly PexelsPhoto[],
      actionPlacement?: BoardInsertionPlacement,
    ) => {
      if (photos.length === 0) return;

      try {
        const insertionPlacement =
          actionPlacement ?? getPlacement?.() ?? placement;
        const imageDimensions = photos.map(({ width, height }) => ({
          width,
          height,
        }));
        if (target === "inbox") {
          for (const photo of photos) {
            await createInboxRemoteImage.mutateAsync(
              toPexelsRemoteImageInput(photo),
            );
          }
        } else {
          for (const [index, photo] of photos.entries()) {
            await createRemoteImage.mutateAsync({
              ...toPexelsRemoteImageInput(photo),
              parentFolderPath,
              placement: insertionPlacement
                ? {
                    ...insertionPlacement,
                    batch: {
                      index,
                      size: photos.length,
                      imageDimensions,
                    },
                  }
                : undefined,
            });
          }
        }
        toast.success(
          `${photos.length} Pexels photo${photos.length === 1 ? "" : "s"} imported`,
        );
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Unable to import Pexels photos.",
        );
      }
    },
    [
      createInboxRemoteImage,
      createRemoteImage,
      getPlacement,
      parentFolderPath,
      placement,
      target,
    ],
  );

  const createTextNote = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      const note = extractPastedNoteTitle(content);
      if (isNoteContentTooLong(note.content)) {
        toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
        return;
      }

      try {
        const insertionPlacement = getPlacement?.() ?? placement;
        if (target === "inbox") {
          await createInboxNote.mutateAsync({
            content: note.content,
            title: note.title,
          });
        } else {
          await createNote.mutateAsync({
            content: note.content,
            title: note.title,
            parentFolderPath,
            placement: insertionPlacement,
          });
        }
        toast.success("Note created");
      } catch (err) {
        toast.error(
          getUserFacingApiErrorMessage(err, "Unable to create note."),
        );
      }
    },
    [
      createInboxNote,
      createNote,
      getPlacement,
      parentFolderPath,
      placement,
      target,
    ],
  );

  const createColorFromHex = useCallback(
    async (hex: string, actionPlacement?: BoardInsertionPlacement) => {
      try {
        const insertionPlacement =
          actionPlacement ?? getPlacement?.() ?? placement;
        if (target === "inbox") {
          await createInboxColor.mutateAsync({ hex });
        } else {
          await createColor.mutateAsync({
            hex,
            parentFolderPath,
            placement: insertionPlacement,
          });
        }
        toast.success("Color created");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Unable to create color.",
        );
      }
    },
    [
      createColor,
      createInboxColor,
      getPlacement,
      parentFolderPath,
      placement,
      target,
    ],
  );

  const addClipboardAsset = useCallback(
    async (payload: ClipboardAssetPayload) => {
      switch (payload.kind) {
        case "image-file":
          await uploadFiles([payload.file]);
          return;

        case "link-url":
          await createLinkFromUrl(payload.url);
          return;

        case "color-hex":
          await createColorFromHex(payload.hex);
          return;

        case "text-note":
          await createTextNote(payload.content);
          return;

        case "empty":
          toast.info("Clipboard is empty");
          return;
      }
    },
    [createColorFromHex, createLinkFromUrl, createTextNote, uploadFiles],
  );

  return {
    addClipboardAsset,
    createTextNote,
    createColorFromHex,
    importPexelsPhotos,
    createLinkFromUrl,
    importVideoFromUrl: (url: string) =>
      videos.importUrl.mutateAsync({
        url,
        position: (getPlacement?.() ?? placement)?.position,
      }),
    isPending:
      isPending || videos.upload.isPending || videos.importUrl.isPending,
    statusText: videos.upload.isPending
      ? "Uploading video"
      : videos.importUrl.isPending
        ? "Importing video"
        : statusText,
    uploadFiles,
  };
}
