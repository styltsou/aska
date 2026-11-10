import { toast } from "sonner";
import { apiGet, getUserFacingApiErrorMessage } from "@/lib/api";
import { fetchAssetImageBlob } from "@/api/collection/fetchers";
import type { ImageAsset, VideoAsset } from "@/types/asset";

export async function downloadAssetOriginal(
  workspaceSlug: string,
  asset: ImageAsset | VideoAsset,
): Promise<void> {
  try {
    let url: string;
    let objectUrl: string | undefined;
    let imageContentType = "";
    if (asset.type === "video") {
      const result = await apiGet<{ url: string }>(
        `/api/v1/workspace/${encodeURIComponent(workspaceSlug)}/assets/${encodeURIComponent(asset.id)}/download?format=json`,
      );
      url = result.url;
    } else {
      const blob = await fetchAssetImageBlob(workspaceSlug, asset.id);
      imageContentType = blob.type;
      objectUrl = URL.createObjectURL(blob);
      url = objectUrl;
    }
    const link = document.createElement("a");
    link.href = url;
    if (asset.type === "image") {
      const extension =
        (
          {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
            "image/avif": "avif",
            "image/svg+xml": "svg",
          } as Record<string, string>
        )[imageContentType || asset.contentType || ""] ?? "";
      const name = (asset.title?.trim() || "image").replace(
        /[\\/:*?"<>|]/g,
        "_",
      );
      link.download =
        extension && !name.toLowerCase().endsWith(`.${extension}`)
          ? `${name}.${extension}`
          : name;
    }
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (objectUrl)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  } catch (error) {
    toast.error(
      getUserFacingApiErrorMessage(error, "Unable to download the original."),
    );
  }
}
