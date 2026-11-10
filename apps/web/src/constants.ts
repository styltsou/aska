export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const SUPPORTED_IMAGE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_IMAGE_MIME_TYPES,
);

export const SUPPORTED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;
export const SUPPORTED_VIDEO_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_VIDEO_MIME_TYPES,
);
export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024;
export const SUPPORTED_VIDEO_ACCEPT = [
  ...SUPPORTED_VIDEO_MIME_TYPES,
  ".mp4",
  ".webm",
].join(",");

// Extensions make native desktop file-picker filters more reliable than MIME types alone.
export const SUPPORTED_IMAGE_ACCEPT = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
].join(",");
export const SUPPORTED_MEDIA_ACCEPT = `${SUPPORTED_IMAGE_ACCEPT},${SUPPORTED_VIDEO_ACCEPT}`;
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
