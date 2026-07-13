export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const SUPPORTED_IMAGE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_IMAGE_MIME_TYPES,
);

export const SUPPORTED_IMAGE_ACCEPT = SUPPORTED_IMAGE_MIME_TYPES.join(",");
