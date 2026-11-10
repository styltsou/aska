import type { ImageAsset } from "@/types/asset";

export function getImageNavigation(
  assets: ImageAsset[],
  currentAssetId?: string,
) {
  const currentIndex = currentAssetId
    ? assets.findIndex((candidate) => candidate.id === currentAssetId)
    : -1;
  const hasNavigation = currentIndex >= 0 && assets.length > 1;

  return {
    currentIndex,
    previousAsset: hasNavigation ? assets[currentIndex - 1] : undefined,
    nextAsset: hasNavigation ? assets[currentIndex + 1] : undefined,
  };
}
