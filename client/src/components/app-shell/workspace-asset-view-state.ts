import type { CollectionImageNode } from "@/api/collection/types";

export type AssetPresentation = {
  assetId: string;
  open: boolean;
  urlStatus: "pending" | "committed";
  presentation?: "fullscreen";
  imageSiblings?: CollectionImageNode[];
};

export function openAssetPresentation(
  assetId: string,
  urlAssetId?: string,
  imageSiblings?: CollectionImageNode[],
  presentation?: "fullscreen",
): AssetPresentation {
  return {
    assetId,
    open: true,
    urlStatus: urlAssetId === assetId ? "committed" : "pending",
    ...(presentation ? { presentation } : {}),
    ...(imageSiblings ? { imageSiblings } : {}),
  };
}

export function syncAssetPresentationToUrl(
  current: AssetPresentation | null,
  urlAssetId?: string,
): AssetPresentation | null {
  if (urlAssetId) {
    if (current?.assetId === urlAssetId) {
      return current.urlStatus === "committed" && current.open
        ? current
        : { ...current, open: true, urlStatus: "committed" };
    }
    return { assetId: urlAssetId, open: true, urlStatus: "committed" };
  }

  if (!current) return current;
  if (current.urlStatus === "pending") return current;
  if (!current.open) return current;
  return { ...current, open: false };
}
