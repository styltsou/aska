import { safeFetch } from "../../url-unfurl-shared/src/safe-fetch";
import type { ResolverMedia, ResolverResult, UrlResolver } from "./types";

const DATA_API_ORIGIN = "https://www.googleapis.com";
const YOUTUBE_ORIGIN = "https://www.youtube.com";
const MAX_RESPONSE_BYTES = 128 * 1024;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^[A-Za-z0-9_-]+$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

type YouTubeDataApiResponse = { items?: unknown };
type YouTubeSnippet = {
  title?: unknown;
  description?: unknown;
  channelId?: unknown;
  channelTitle?: unknown;
  thumbnails?: unknown;
};

export class YouTubeDataApiResolver implements UrlResolver {
  readonly key = "youtube-data-api";
  readonly version = "1";

  constructor(private readonly apiKey: string | undefined) {}

  matches(url: URL): boolean {
    return extractVideoId(url) !== null;
  }

  async resolve(url: URL): Promise<ResolverResult> {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Unsupported YouTube video URL");

    try {
      if (!this.apiKey?.trim())
        throw new Error("YouTube Data API key is missing");
      return await this.resolveWithDataApi(videoId);
    } catch {
      // Do not fall into generic HTML metadata: its description is site-level,
      // not video-level. The client can still render a useful video card.
      return minimalYouTubeResult(this.key, this.version, videoId);
    }
  }

  private async resolveWithDataApi(videoId: string): Promise<ResolverResult> {
    const endpoint = new URL("/youtube/v3/videos", DATA_API_ORIGIN);
    endpoint.searchParams.set("part", "snippet");
    endpoint.searchParams.set("id", videoId);
    endpoint.searchParams.set(
      "fields",
      "items(id,snippet(title,description,channelId,channelTitle,thumbnails))",
    );
    endpoint.searchParams.set("key", this.apiKey!.trim());

    const response = await safeFetch(endpoint, {
      accept: "application/json",
      allowedContentTypes: ["application/json"],
      maxBytes: MAX_RESPONSE_BYTES,
      totalTimeoutMs: 5_000,
    });
    const snippet = parseSnippet(response.body, videoId);
    const thumbnailUrl = selectThumbnailUrl(snippet.thumbnails);
    return youtubeResult({
      resolverKey: this.key,
      resolverVersion: this.version,
      videoId,
      title: boundedText(snippet.title, 255),
      description: boundedText(snippet.description, 2_000),
      channelName: boundedText(snippet.channelTitle, 255),
      channelUrl: channelUrlFor(snippet.channelId),
      thumbnailUrl,
      thumbnailSource: thumbnailUrl
        ? "youtube:data-api:thumbnail"
        : "youtube:fallback:hqdefault",
    });
  }
}

function minimalYouTubeResult(
  resolverKey: string,
  resolverVersion: string,
  videoId: string,
): ResolverResult {
  return youtubeResult({
    resolverKey,
    resolverVersion,
    videoId,
    title: null,
    description: null,
    channelName: null,
    channelUrl: null,
    thumbnailUrl: null,
    thumbnailSource: "youtube:fallback:hqdefault",
  });
}

function youtubeResult(input: {
  resolverKey: string;
  resolverVersion: string;
  videoId: string;
  title: string | null;
  description: string | null;
  channelName: string | null;
  channelUrl: string | null;
  thumbnailUrl: string | null;
  thumbnailSource: string;
}): ResolverResult {
  const canonicalUrl = canonicalVideoUrl(input.videoId);
  const thumbnailUrl = input.thumbnailUrl ?? thumbnailUrlFor(input.videoId);
  const media: ResolverMedia[] = [
    {
      role: "preview",
      sourceUrl: thumbnailUrl,
      sourceMetadata: input.thumbnailSource,
      processingProfile: "link-preview-v2",
      alt: input.title,
    },
  ];
  return {
    resolverKey: input.resolverKey,
    resolverVersion: input.resolverVersion,
    finalUrl: canonicalUrl,
    canonicalUrl,
    title: input.title,
    description: input.description,
    siteName: "YouTube",
    resourceKind: "video",
    fieldProvenance: {
      title: { resolver: input.resolverKey, source: "youtube:data-api:title" },
      description: {
        resolver: input.resolverKey,
        source: "youtube:data-api:description",
      },
      siteName: { resolver: input.resolverKey, source: "provider:youtube" },
      resourceKind: { resolver: input.resolverKey, source: "provider:youtube" },
      canonicalUrl: { resolver: input.resolverKey, source: "url:video-id" },
    },
    providerExtensions: {
      youtube: {
        videoId: input.videoId,
        channelName: input.channelName,
        channelUrl: input.channelUrl,
      },
    },
    media,
  };
}

function extractVideoId(url: URL): string | null {
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

function canonicalVideoUrl(videoId: string): string {
  return `${YOUTUBE_ORIGIN}/watch?v=${videoId}`;
}

function thumbnailUrlFor(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function parseSnippet(body: Uint8Array, videoId: string): YouTubeSnippet {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Invalid YouTube Data API response");
    const { items } = parsed as YouTubeDataApiResponse;
    if (!Array.isArray(items) || items.length !== 1)
      throw new Error("Video not found");
    const item = items[0];
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Invalid YouTube Data API response");
    const { id, snippet } = item as { id?: unknown; snippet?: unknown };
    if (
      id !== videoId ||
      !snippet ||
      typeof snippet !== "object" ||
      Array.isArray(snippet)
    )
      throw new Error("Invalid YouTube Data API response");
    return snippet as YouTubeSnippet;
  } catch {
    throw new Error("Invalid YouTube Data API response");
  }
}

function selectThumbnailUrl(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const candidate = (value as Record<string, unknown>)[key];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      continue;
    const url = safeHttpUrl((candidate as { url?: unknown }).url);
    if (url) return url;
  }
  return null;
}

function channelUrlFor(value: unknown): string | null {
  return typeof value === "string" && CHANNEL_ID.test(value)
    ? `${YOUTUBE_ORIGIN}/channel/${value}`
    : null;
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4_096) return null;
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password
    )
      return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
