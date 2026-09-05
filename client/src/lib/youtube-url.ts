const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

/** Matches the YouTube video URL shapes accepted by the URL resolver. */
export function isYouTubeVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    let candidate: string | null = null;

    if (host === "youtu.be") {
      const segments = url.pathname.split("/").filter(Boolean);
      candidate = segments.length === 1 ? segments[0]! : null;
    } else if (YOUTUBE_HOSTS.has(host)) {
      if (url.pathname === "/watch") candidate = url.searchParams.get("v");
      else {
        const match = url.pathname.match(
          /^\/(?:shorts|live|embed)\/([^/]+)\/?$/,
        );
        candidate = match?.[1] ?? null;
      }
    }

    return candidate !== null && VIDEO_ID.test(candidate);
  } catch {
    return false;
  }
}
