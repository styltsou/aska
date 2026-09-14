import type { CollectionImageNode } from "@/api/collection/types";

export type AssetPresentation = {
  assetId: string;
  open: boolean;
  urlStatus: "pending" | "committed";
  closeOrigin?: "internal" | "external" | "waiting-for-url";
  imageSiblings?: CollectionImageNode[];
};

export function openAssetPresentation(
  assetId: string,
  urlAssetId?: string,
  imageSiblings?: CollectionImageNode[],
): AssetPresentation {
  return {
    assetId,
    open: true,
    urlStatus: urlAssetId === assetId ? "committed" : "pending",
    ...(imageSiblings ? { imageSiblings } : {}),
  };
}

export function requestAssetPresentationClose(
  current: AssetPresentation | null,
): AssetPresentation | null {
  return current
    ? { ...current, open: false, closeOrigin: "internal" }
    : current;
}

export function syncAssetPresentationToUrl(
  current: AssetPresentation | null,
  urlAssetId?: string,
): AssetPresentation | null {
  if (urlAssetId) {
    if (current?.assetId === urlAssetId) {
      return current.urlStatus === "committed"
        ? current
        : { ...current, urlStatus: "committed" };
    }
    return { assetId: urlAssetId, open: true, urlStatus: "committed" };
  }

  if (!current) return current;
  if (current.urlStatus === "pending") return current;
  if (current.closeOrigin === "waiting-for-url") return null;
  if (!current.open) return current;
  return { ...current, open: false, closeOrigin: "external" };
}

export function completeAssetPresentationClose(
  current: AssetPresentation | null,
): {
  presentation: AssetPresentation | null;
  shouldCleanupUrl: boolean;
} {
  if (!current || current.open) {
    return { presentation: current, shouldCleanupUrl: false };
  }
  if (current.closeOrigin === "external") {
    return { presentation: null, shouldCleanupUrl: false };
  }
  if (current.closeOrigin !== "internal") {
    return { presentation: current, shouldCleanupUrl: false };
  }
  return {
    presentation: { ...current, closeOrigin: "waiting-for-url" },
    shouldCleanupUrl: true,
  };
}
