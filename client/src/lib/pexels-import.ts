import type { CreateRemoteImageInput } from "@/api/collection";
import type { PexelsPhoto } from "@/api/pexels";

export function toPexelsRemoteImageInput(
  photo: PexelsPhoto,
): CreateRemoteImageInput {
  return {
    url: photo.urls.original,
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
