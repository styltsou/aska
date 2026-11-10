import type { ResolvedMediaUrl } from "@/api/media";
import type { CreateRemoteImageInput } from "@/api/collection";
import { isDirectVideoUrl } from "@/lib/video-url";
import { isYouTubeVideoUrl } from "@/lib/youtube-url";

export type UrlAssetResolution =
  | { kind: "link" }
  | { kind: "video"; url: string }
  | {
      kind: "image";
      url: string;
      sourceUrl?: string;
      title?: string;
      alt?: string;
    };

const DIRECT_IMAGE_PATH = /\.(?:gif|jpe?g|png|webp)$/i;

/**
 * Classifies a pasted URL before the generic link unfurler claims it.
 *
 * Extension checks keep obvious media fast, while content-type inspection
 * covers CDN URLs (including images.unsplash.com) whose paths have no suffix.
 * The import endpoints still verify the response before storing any media.
 */
export async function resolveUrlAsset(
  url: string,
  inspectMedia: (url: string) => Promise<ResolvedMediaUrl>,
): Promise<UrlAssetResolution> {
  if (isDirectVideoUrl(url)) return { kind: "video", url };
  if (isDirectImageUrl(url)) return { kind: "image", url };
  if (isYouTubeVideoUrl(url)) return { kind: "link" };

  try {
    const media = await inspectMedia(url);
    if (media.kind === "video") return { kind: "video", url: media.url ?? url };
    return {
      kind: "image",
      url: media.url ?? url,
      ...(media.sourceUrl ? { sourceUrl: media.sourceUrl } : {}),
      ...(media.title ? { title: media.title } : {}),
      ...(media.alt ? { alt: media.alt } : {}),
    };
  } catch {
    return { kind: "link" };
  }
}

export function isDirectImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      DIRECT_IMAGE_PATH.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function toResolvedRemoteImageInput(
  fallbackUrl: string,
  media: Pick<ResolvedMediaUrl, "url" | "sourceUrl" | "title" | "alt">,
): CreateRemoteImageInput {
  return {
    url: media.url ?? fallbackUrl,
    ...(media.sourceUrl
      ? { provenance: { provider: "url" as const, url: media.sourceUrl } }
      : {}),
    ...(media.title ? { title: media.title } : {}),
    ...(media.alt ? { alt: media.alt } : {}),
  };
}
