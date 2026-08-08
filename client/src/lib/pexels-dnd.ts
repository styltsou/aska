import type { PexelsPhoto } from "@/api/pexels";

export const PEXELS_PHOTO_DRAG_TYPE = "pexels-photo";
export const PEXELS_CANVAS_DROP_TYPE = "pexels-canvas";

export type PexelsPhotoDragData = {
  photos: readonly PexelsPhoto[];
};
