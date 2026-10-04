import { useCallback, useSyncExternalStore } from "react";

export type VideoUploadPreview = {
  sourceUrl: string;
  posterUrl?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  status: "uploading" | "processing";
  progress: number;
};

const previews = new Map<string, VideoUploadPreview>();
const listeners = new Map<string, Set<() => void>>();

function emit(assetId: string) {
  for (const listener of listeners.get(assetId) ?? []) listener();
}

function updatePreview(assetId: string, update: Partial<VideoUploadPreview>) {
  const current = previews.get(assetId);
  if (!current) return;
  previews.set(assetId, { ...current, ...update });
  emit(assetId);
}

function extractPoster(assetId: string, sourceUrl: string) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = sourceUrl;

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    video.removeAttribute("src");
    video.load();
  };
  const capture = () => {
    const current = previews.get(assetId);
    if (current?.sourceUrl !== sourceUrl) return finish();

    const width = video.videoWidth || undefined;
    const height = video.videoHeight || undefined;
    const durationSeconds = Number.isFinite(video.duration)
      ? video.duration
      : undefined;
    updatePreview(assetId, { width, height, durationSeconds });
    if (!width || !height) return finish();

    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return finish();
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob && previews.get(assetId)?.sourceUrl === sourceUrl) {
          updatePreview(assetId, { posterUrl: URL.createObjectURL(blob) });
        }
        finish();
      },
      "image/webp",
      0.82,
    );
  };
  const seekToPreview = () => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const previewTime = Math.min(0.5, duration * 0.1);
    if (previewTime > 0.01) {
      video.addEventListener("seeked", capture, { once: true });
      video.currentTime = previewTime;
    } else {
      video.addEventListener("loadeddata", capture, { once: true });
    }
  };
  const timeout = window.setTimeout(finish, 10_000);
  video.addEventListener("loadedmetadata", seekToPreview, { once: true });
  video.addEventListener("error", finish, { once: true });
  video.load();
}

export function beginVideoUploadPreview(assetId: string, file: File) {
  clearVideoUploadPreview(assetId);
  const sourceUrl = URL.createObjectURL(file);
  previews.set(assetId, {
    sourceUrl,
    status: "uploading",
    progress: 0,
  });
  emit(assetId);
  extractPoster(assetId, sourceUrl);
}

export function updateVideoUploadPreview(
  assetId: string,
  update: Pick<VideoUploadPreview, "status"> &
    Partial<Pick<VideoUploadPreview, "progress">>,
) {
  updatePreview(assetId, update);
}

export function clearVideoUploadPreview(assetId: string) {
  const current = previews.get(assetId);
  if (!current) return;
  URL.revokeObjectURL(current.sourceUrl);
  if (current.posterUrl) URL.revokeObjectURL(current.posterUrl);
  previews.delete(assetId);
  emit(assetId);
}

export function useVideoUploadPreview(assetId: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const current = listeners.get(assetId) ?? new Set();
      current.add(listener);
      listeners.set(assetId, current);
      return () => {
        current.delete(listener);
        if (current.size === 0) listeners.delete(assetId);
      };
    },
    [assetId],
  );
  const getSnapshot = useCallback(() => previews.get(assetId), [assetId]);

  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}
