import { useCallback, useEffect, useRef, useState } from "react";

import type { ImageAsset } from "@/types/asset";

export function useImmediateImageViewer(
  routeImage: ImageAsset | undefined,
  routeImageId: string | undefined,
) {
  const [viewerImage, setViewerImage] = useState(routeImage);
  const lastResolvedRouteImageId = useRef(routeImage?.id);

  useEffect(() => {
    if (!routeImageId) {
      lastResolvedRouteImageId.current = undefined;
      setViewerImage(undefined);
      return;
    }

    if (routeImage?.id !== routeImageId) {
      if (lastResolvedRouteImageId.current !== routeImageId) {
        setViewerImage(undefined);
      }
      return;
    }

    if (lastResolvedRouteImageId.current !== routeImageId) {
      lastResolvedRouteImageId.current = routeImageId;
      setViewerImage(routeImage);
    }
  }, [routeImage, routeImage?.id, routeImageId]);

  const openViewer = useCallback((image: ImageAsset) => {
    setViewerImage(image);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerImage(undefined);
  }, []);

  return { viewerImage, openViewer, closeViewer };
}
