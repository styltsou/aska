import type { Transition } from "motion/react";
import { createContext, useContext } from "react";

export const ActiveImageViewerContext = createContext<string | undefined>(
  undefined,
);

export function useActiveImageViewer(): string | undefined {
  return useContext(ActiveImageViewerContext);
}

export const IMAGE_VIEWER_TRANSITION: Transition = {
  layout: {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1],
  },
};

export function getImageViewerLayoutId(assetId: string): string {
  return `image-viewer-${assetId}`;
}
