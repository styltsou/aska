import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { BoardPosition } from "@/api/collection/types";
import { collectionQueryKeys } from "@/api/collection/query-keys";
import {
  MAX_VIDEO_UPLOAD_BYTES,
  SUPPORTED_VIDEO_MIME_TYPE_SET,
} from "@/constants";
import { apiGet, apiPost } from "@/lib/api";

type VideoScope = {
  workspaceSlug: string;
  collectionSlug?: string;
  parentFolderPath?: string;
};

type Upload = {
  id: number;
  url: string;
  headers: Record<string, string>;
  maxSizeBytes: number;
};
type Status = {
  id: number;
  status: "pending" | "uploaded" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  assetId: string;
};

function basePath(scope: VideoScope) {
  const workspace = encodeURIComponent(scope.workspaceSlug);
  return scope.collectionSlug
    ? `/api/v1/workspace/${workspace}/collections/${encodeURIComponent(scope.collectionSlug)}/videos`
    : `/api/v1/workspace/${workspace}/inbox/videos`;
}

function videoMime(file: File): "video/mp4" | "video/webm" {
  const mime =
    file.type ||
    (/\.webm$/i.test(file.name)
      ? "video/webm"
      : /\.mp4$/i.test(file.name)
        ? "video/mp4"
        : "");
  if (!SUPPORTED_VIDEO_MIME_TYPE_SET.has(mime))
    throw new Error("Choose an MP4 or WebM video");
  return mime as "video/mp4" | "video/webm";
}

function putFile(
  file: File,
  upload: Upload,
  onProgress?: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload.url);
    for (const [key, value] of Object.entries(upload.headers))
      request.setRequestHeader(key, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed: ${request.status}`));
    request.onerror = () => reject(new Error("Upload failed"));
    request.onabort = () => reject(new Error("Upload cancelled"));
    request.send(file);
  });
}

export function useVideoAssets(scope: VideoScope) {
  const queryClient = useQueryClient();
  const path = basePath(scope);
  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: scope.collectionSlug
        ? collectionQueryKeys.contentScope(
            scope.workspaceSlug,
            scope.collectionSlug,
          )
        : collectionQueryKeys.inbox(scope.workspaceSlug),
    });
    void queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.collections(scope.workspaceSlug),
    });
  };
  const watch = async (id: number) => {
    for (let attempt = 0; attempt < 180; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      let upload: Status;
      try {
        ({ upload } = await apiGet<{ upload: Status }>(
          `${path}/uploads/${id}`,
        ));
      } catch {
        // A temporary network failure should not abandon a still-processing asset.
        continue;
      }
      if (upload.status === "completed") {
        refresh();
        toast.success("Video ready");
        return;
      }
      if (upload.status === "failed") {
        refresh();
        toast.error(upload.errorMessage ?? "Video processing failed");
        return;
      }
    }
    refresh();
  };

  const upload = useMutation({
    mutationFn: async ({
      file,
      position,
    }: {
      file: File;
      position?: BoardPosition;
    }) => {
      const contentType = videoMime(file);
      if (file.size === 0 || file.size > MAX_VIDEO_UPLOAD_BYTES)
        throw new Error("Video must be between 1 byte and 250 MB");
      const { upload: created } = await apiPost<{ upload: Upload }>(
        `${path}/uploads`,
        {
          fileName: file.name || "video",
          contentType,
          sizeBytes: file.size,
          parentFolderPath: scope.parentFolderPath,
          position,
        },
      );
      refresh();
      const toastId = toast.loading(`Uploading ${file.name}…`);
      try {
        await putFile(file, created, (percent) =>
          toast.loading(`Uploading ${file.name} — ${percent}%`, {
            id: toastId,
          }),
        );
        toast.loading("Processing video…", { id: toastId });
        void watch(created.id).finally(() => toast.dismiss(toastId));
      } catch (error) {
        await apiPost(`${path}/uploads/${created.id}/fail`).catch(
          () => undefined,
        );
        refresh();
        toast.error(error instanceof Error ? error.message : "Upload failed", {
          id: toastId,
        });
        throw error;
      }
    },
  });
  const importUrl = useMutation({
    mutationFn: async ({
      url,
      position,
    }: {
      url: string;
      position?: BoardPosition;
    }) => {
      const { upload: created } = await apiPost<{ upload: Status }>(
        `${path}/remote`,
        {
          url,
          parentFolderPath: scope.parentFolderPath,
          position,
        },
      );
      refresh();
      if (created.status === "failed") {
        toast.error(created.errorMessage ?? "Could not start video import");
      } else {
        toast.info("Importing video");
        void watch(created.id);
      }
    },
  });
  return { upload, importUrl };
}
