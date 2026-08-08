import type { CreateRemoteImageInput } from "@/api/collection";
import type { PexelsPhoto } from "@/api/pexels";

export function toPexelsRemoteImageInput(
  photo: PexelsPhoto,
): CreateRemoteImageInput & {
  preview: {
    url: string;
    fallbackUrl: string;
    width: number;
    height: number;
  };
} {
  return {
    url: photo.urls.original,
    preview: {
      url: photo.urls.regular,
      // This exact URL is already loaded by the browser tile and drag overlay.
      fallbackUrl: photo.urls.small,
      width: photo.width,
      height: photo.height,
    },
    title: photo.alt ?? undefined,
    alt: photo.alt ?? undefined,
    provenance: {
      provider: "pexels",
      url: photo.url,
      downloadUrl: photo.urls.original,
      attribution: {
        photoId: photo.id,
        name: photo.photographer.name,
        profileUrl: photo.photographer.profileUrl,
      },
    },
  };
}
