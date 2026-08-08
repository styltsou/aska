import type { PexelsPhoto } from "@/api/pexels";

export const PEXELS_PHOTO_DRAG_TYPE = "application/x-aska-pexels-photos";

export function hasPexelsPhotoDrag(
  dataTransfer: Pick<DataTransfer, "types">,
): boolean {
  return Array.from(dataTransfer.types).includes(PEXELS_PHOTO_DRAG_TYPE);
}

export function setPexelsPhotoDragData(
  dataTransfer: Pick<DataTransfer, "setData">,
  photos: readonly PexelsPhoto[],
) {
  dataTransfer.setData(PEXELS_PHOTO_DRAG_TYPE, JSON.stringify(photos));
  dataTransfer.setData(
    "text/plain",
    photos.map((photo) => photo.url).join("\n"),
  );
}

export function getPexelsPhotoDragData(
  dataTransfer: Pick<DataTransfer, "getData">,
): PexelsPhoto[] {
  try {
    const payload: unknown = JSON.parse(
      dataTransfer.getData(PEXELS_PHOTO_DRAG_TYPE),
    );
    return Array.isArray(payload) ? payload.filter(isPexelsPhoto) : [];
  } catch {
    return [];
  }
}

function isPexelsPhoto(value: unknown): value is PexelsPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Record<string, unknown>;
  const urls = photo.urls as Record<string, unknown> | undefined;
  const photographer = photo.photographer as
    | Record<string, unknown>
    | undefined;

  return (
    typeof photo.id === "string" &&
    typeof photo.width === "number" &&
    typeof photo.height === "number" &&
    (typeof photo.alt === "string" || photo.alt === null) &&
    typeof photo.url === "string" &&
    typeof urls?.thumb === "string" &&
    typeof urls.small === "string" &&
    typeof urls.regular === "string" &&
    typeof urls.original === "string" &&
    typeof photographer?.name === "string" &&
    typeof photographer.profileUrl === "string"
  );
}
