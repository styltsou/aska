import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import {
  useCreateInboxNote,
  useCreateInboxRemoteImage,
  useCreateNote,
  useCreateRemoteImage,
  useUploadInboxImages,
  useUploadLocalImages,
} from "@/api/collection";
import type { BoardInsertionPlacement } from "@/api/collection";
import { SUPPORTED_IMAGE_MIME_TYPE_SET } from "@/constants";
import type { ClipboardAssetPayload } from "@/lib/clipboard";
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
  const uploadInboxImages = useUploadInboxImages(workspaceSlug);
  const createInboxRemoteImage = useCreateInboxRemoteImage(workspaceSlug);

  const isPending =
    createNote.isPending ||
    uploadLocalImages.isPending ||
    createRemoteImage.isPending ||
    createInboxNote.isPending ||
    uploadInboxImages.isPending ||
    createInboxRemoteImage.isPending;

  const statusText = useMemo(() => {
    if (uploadLocalImages.isPending) return "Uploading images";
    if (createNote.isPending) return "Creating note";
    if (createRemoteImage.isPending) return "Importing image";
    if (createInboxNote.isPending) return "Creating note";
    if (uploadInboxImages.isPending) return "Uploading images";
    if (createInboxRemoteImage.isPending) return "Importing image";
    return null;
  }, [
    createInboxNote.isPending,
    createInboxRemoteImage.isPending,
    createNote.isPending,
    createRemoteImage.isPending,
    uploadInboxImages.isPending,
    uploadLocalImages.isPending,
  ]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((file) =>
        SUPPORTED_IMAGE_MIME_TYPE_SET.has(file.type),
      );
      if (imageFiles.length === 0) return;

      try {
        const insertionPlacement = getPlacement?.() ?? placement;
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

  const importRemoteUrl = useCallback(
    async (value: string) => {
      const url = parseHttpUrl(value);
      if (!url) return;

      try {
        const insertionPlacement = getPlacement?.() ?? placement;
        if (target === "inbox") {
          await createInboxRemoteImage.mutateAsync({
            url,
          });
        } else {
          await createRemoteImage.mutateAsync({
            url,
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

  const addClipboardAsset = useCallback(
    async (payload: ClipboardAssetPayload) => {
      switch (payload.kind) {
        case "image-file":
          await uploadFiles([payload.file]);
          return;

        case "remote-image-url":
          await importRemoteUrl(payload.url);
          return;

        case "text-note":
          await createTextNote(payload.content);
          return;

        case "empty":
          toast.info("Clipboard is empty");
          return;
      }
    },
    [createTextNote, importRemoteUrl, uploadFiles],
  );

  return {
    addClipboardAsset,
    createTextNote,
    importRemoteUrl,
    isPending,
    statusText,
    uploadFiles,
  };
}
