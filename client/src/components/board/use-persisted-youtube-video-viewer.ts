import { useCallback, useEffect, useState } from "react";

import type { LinkAsset } from "@/types/asset";

type ViewerState = {
  storageKey: string;
  video: LinkAsset | undefined;
};

/** Keeps a board's open YouTube video for the lifetime of the current browser tab. */
export function usePersistedYouTubeVideoViewer(storageKey: string) {
  const [state, setState] = useState<ViewerState>(() => ({
    storageKey,
    video: readStoredVideo(storageKey),
  }));
  const viewerVideo = state.storageKey === storageKey ? state.video : undefined;

  useEffect(() => {
    if (state.storageKey === storageKey) return;
    setState({ storageKey, video: readStoredVideo(storageKey) });
  }, [state.storageKey, storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey) return;
    try {
      if (state.video) {
        sessionStorage.setItem(storageKey, JSON.stringify(state.video));
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [state, storageKey]);

  const openViewer = useCallback(
    (video: LinkAsset) => setState({ storageKey, video }),
    [storageKey],
  );
  const closeViewer = useCallback(
    () => setState({ storageKey, video: undefined }),
    [storageKey],
  );

  return { viewerVideo, openViewer, closeViewer };
}

function readStoredVideo(storageKey: string): LinkAsset | undefined {
  try {
    const rawVideo = sessionStorage.getItem(storageKey);
    if (!rawVideo) return undefined;
    const video: unknown = JSON.parse(rawVideo);
    if (
      typeof video === "object" &&
      video !== null &&
      "id" in video &&
      typeof video.id === "string" &&
      "type" in video &&
      video.type === "link" &&
      "originalUrl" in video &&
      typeof video.originalUrl === "string" &&
      "title" in video &&
      typeof video.title === "string" &&
      "video" in video &&
      typeof video.video === "object" &&
      video.video !== null &&
      "provider" in video.video &&
      video.video.provider === "youtube" &&
      "videoId" in video.video &&
      typeof video.video.videoId === "string"
    ) {
      return video as LinkAsset;
    }
    sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore malformed or unavailable session storage.
  }
  return undefined;
}
