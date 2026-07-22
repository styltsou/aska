import type { Transition } from "motion/react";

export const IMAGE_VIEWER_TRANSITION: Transition = {
  duration: 0.14,
  ease: [0.16, 1, 0.3, 1],
};

export function getImageViewerLayoutId(assetId: string): string {
  return `image-viewer-${assetId}`;
}
