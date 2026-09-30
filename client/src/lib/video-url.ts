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
