export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const SUPPORTED_IMAGE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_IMAGE_MIME_TYPES,
);

// Extensions make native desktop file-picker filters more reliable than MIME types alone.
export const SUPPORTED_IMAGE_ACCEPT = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
].join(",");
