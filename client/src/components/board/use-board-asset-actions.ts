import { useCallback, useMemo } from "react";
import { toast } from "sonner";

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
import type { PexelsPhoto } from "@/api/pexels";
import { SUPPORTED_IMAGE_MIME_TYPE_SET } from "@/constants";
import type { ClipboardAssetPayload } from "@/lib/clipboard";
import { toPexelsRemoteImageInput } from "@/lib/pexels-import";
import { parseHttpUrl } from "@/lib/utils";

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
    createInboxColor.isPending;

  const statusText = useMemo(() => {
    if (uploadLocalImages.isPending) return "Uploading images";
    if (createNote.isPending) return "Creating note";
    if (createRemoteImage.isPending) return "Importing image";
    if (createInboxNote.isPending) return "Creating note";
    if (uploadInboxImages.isPending) return "Uploading images";
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
  ]);

  const uploadFiles = useCallback(
    async (files: File[], actionPlacement?: BoardInsertionPlacement) => {
      const imageFiles = files.filter((file) =>
        SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type),
      );
      if (imageFiles.length === 0) return;

      try {
        const insertionPlacement =
          actionPlacement ?? getPlacement?.() ?? placement;
        if (target === "inbox") {
          await uploadInboxImages.mutateAsync({
            files: imageFiles,
          });
        } else {
          await uploadLocalImages.mutateAsync({
            files: imageFiles,
            parentFolderPath,
            placement: insertionPlacement,
          });
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Unable to upload images.",
        );
      }
    },
    [
      getPlacement,
      parentFolderPath,
      placement,
      target,
      uploadInboxImages,
      uploadLocalImages,
    ],
  );

  const createLinkFromUrl = useCallback(
    async (value: string, actionPlacement?: BoardInsertionPlacement) => {
      const url = parseHttpUrl(value);
      if (!url) return;

      try {
        const insertionPlacement =
          actionPlacement ?? getPlacement?.() ?? placement;
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
      createLink,
      getPlacement,
      parentFolderPath,
      placement,
      target,
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

      try {
        const insertionPlacement = getPlacement?.() ?? placement;
        if (target === "inbox") {
          await createInboxNote.mutateAsync({
            content,
          });
        } else {
          await createNote.mutateAsync({
            content,
            parentFolderPath,
            placement: insertionPlacement,
          });
        }
        toast.success("Note created");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Unable to create note.",
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
    isPending,
    statusText,
    uploadFiles,
  };
}
