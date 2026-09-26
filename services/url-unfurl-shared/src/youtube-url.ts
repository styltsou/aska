const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

export const YOUTUBE_RESOLVER_KEY = "youtube-data-api";
export const YOUTUBE_RESOLVER_VERSION = "3";

export function getYouTubeVideoId(value: string | URL): string | null {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be") {
    const segments = url.pathname.split("/").filter(Boolean);
    candidate = segments.length === 1 ? segments[0]! : null;
  } else if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === "/watch") candidate = url.searchParams.get("v");
    else {
      const match = url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)\/?$/);
      candidate = match?.[1] ?? null;
    }
  }

  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

export function isYouTubeVideoUrl(value: string | URL): boolean {
  return getYouTubeVideoId(value) !== null;
}
