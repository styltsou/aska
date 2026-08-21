import { useCallback, useEffect, useState } from "react";

import type { ImageAsset } from "@/types/asset";

type ViewerState = {
  storageKey: string;
  image: ImageAsset | undefined;
};

/** Keeps a board's open image for the lifetime of the current browser tab. */
export function usePersistedImageViewer(storageKey: string) {
  const [state, setState] = useState<ViewerState>(() => ({
    storageKey,
    image: readStoredImage(storageKey),
  }));
  const viewerImage = state.storageKey === storageKey ? state.image : undefined;

  useEffect(() => {
    if (state.storageKey === storageKey) return;
    setState({ storageKey, image: readStoredImage(storageKey) });
  }, [state.storageKey, storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey) return;
    try {
      if (state.image) {
        sessionStorage.setItem(storageKey, JSON.stringify(state.image));
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [state, storageKey]);

  const openViewer = useCallback(
    (image: ImageAsset) => setState({ storageKey, image }),
    [storageKey],
  );
  const closeViewer = useCallback(
    () => setState({ storageKey, image: undefined }),
    [storageKey],
  );

  return { viewerImage, openViewer, closeViewer };
}

function readStoredImage(storageKey: string): ImageAsset | undefined {
  try {
    const rawImage = sessionStorage.getItem(storageKey);
    if (!rawImage) return undefined;
    const image: unknown = JSON.parse(rawImage);
    if (
      typeof image === "object" &&
      image !== null &&
      "id" in image &&
      typeof image.id === "string" &&
      "type" in image &&
      image.type === "image" &&
      "url" in image &&
      typeof image.url === "string" &&
      "width" in image &&
      typeof image.width === "number" &&
      "height" in image &&
      typeof image.height === "number"
    ) {
      return image as ImageAsset;
    }
    sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore malformed or unavailable session storage.
  }
  return undefined;
}
