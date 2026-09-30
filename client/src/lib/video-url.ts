/** Conservative paste classification; the server still verifies the response MIME type. */
const DIRECT_VIDEO_PATH = /\.(?:mp4|webm)$/i;

export function isDirectVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      DIRECT_VIDEO_PATH.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** File MIME is sometimes empty or octet-stream; the server verifies the actual streams. */
export function inferVideoMime(
  file: Pick<File, "name" | "type">,
): "video/mp4" | "video/webm" | null {
  if (file.type === "video/mp4" || file.type === "video/webm") return file.type;
  if (/\.mp4$/i.test(file.name)) return "video/mp4";
  if (/\.webm$/i.test(file.name)) return "video/webm";
  return null;
}
