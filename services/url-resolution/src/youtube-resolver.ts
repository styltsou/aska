import { safeFetch } from "../../url-unfurl-shared/src/safe-fetch";
import {
  getYouTubeVideoId,
  YOUTUBE_RESOLVER_KEY,
  YOUTUBE_RESOLVER_VERSION,
} from "../../url-unfurl-shared/src/youtube-url";
import type { ResolverMedia, ResolverResult, UrlResolver } from "./types";

const DATA_API_ORIGIN = "https://www.googleapis.com";
const YOUTUBE_ORIGIN = "https://www.youtube.com";
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const CHANNEL_ID = /^[A-Za-z0-9_-]+$/;

type YouTubeDataApiResponse = { items?: unknown };
type YouTubePageVideoDetails = {
  title?: unknown;
  shortDescription?: unknown;
  channelId?: unknown;
  author?: unknown;
  thumbnail?: unknown;
};
type YouTubeSnippet = {
  title?: unknown;
  description?: unknown;
  channelId?: unknown;
  channelTitle?: unknown;
  thumbnails?: unknown;
};

export class YouTubeDataApiResolver implements UrlResolver {
  readonly key = YOUTUBE_RESOLVER_KEY;
  readonly version = YOUTUBE_RESOLVER_VERSION;

  constructor(private readonly apiKey: string | undefined) {}

  matches(url: URL): boolean {
    return getYouTubeVideoId(url) !== null;
  }

  async resolve(url: URL): Promise<ResolverResult> {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) throw new Error("Unsupported YouTube video URL");

    try {
      if (!this.apiKey?.trim())
        throw new Error("YouTube Data API key is missing");
      return await this.resolveWithDataApi(videoId);
    } catch {
      try {
        // Keep this provider-specific: the player payload carries the video's
        // own description, unlike the generic YouTube page metadata.
        return await this.resolveWithYouTubePage(videoId);
      } catch {
        return minimalYouTubeResult(this.key, this.version, videoId);
      }
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
      description: formatDescription(snippet.description, 2_000),
      channelName: boundedText(snippet.channelTitle, 255),
      channelUrl: channelUrlFor(snippet.channelId),
      thumbnailUrl,
      thumbnailSource: thumbnailUrl
        ? "youtube:data-api:thumbnail"
        : "youtube:fallback:hqdefault",
      titleSource: "youtube:data-api:title",
      descriptionSource: "youtube:data-api:description",
    });
  }

  private async resolveWithYouTubePage(
    videoId: string,
  ): Promise<ResolverResult> {
    const endpoint = new URL(canonicalVideoUrl(videoId));
    const response = await safeFetch(endpoint, {
      accept: "text/html,application/xhtml+xml;q=0.9",
      allowedContentTypes: ["text/html", "application/xhtml+xml"],
      maxBytes: MAX_PAGE_BYTES,
      totalTimeoutMs: 10_000,
      bodyMode: "full",
    });
    const details = parseYouTubePage(response.body, videoId);
    const thumbnailUrl = selectThumbnailUrl(details.thumbnail);
    return youtubeResult({
      resolverKey: this.key,
      resolverVersion: this.version,
      videoId,
      title: boundedText(details.title, 255),
      description: formatDescription(details.shortDescription, 2_000),
      channelName: boundedText(details.author, 255),
      channelUrl: channelUrlFor(details.channelId),
      thumbnailUrl,
      thumbnailSource: thumbnailUrl
        ? "youtube:page:thumbnail"
        : "youtube:fallback:hqdefault",
      titleSource: "youtube:page:video-details:title",
      descriptionSource: "youtube:page:video-details:short-description",
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
  titleSource?: string;
  descriptionSource?: string;
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
      ...(input.titleSource
        ? { title: { resolver: input.resolverKey, source: input.titleSource } }
        : {}),
      ...(input.descriptionSource
        ? {
            description: {
              resolver: input.resolverKey,
              source: input.descriptionSource,
            },
          }
        : {}),
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

function parseYouTubePage(
  body: Uint8Array,
  videoId: string,
): YouTubePageVideoDetails {
  try {
    const html = new TextDecoder().decode(body);
    const playerResponse = extractJsonObject(html, "ytInitialPlayerResponse");
    if (
      !playerResponse ||
      typeof playerResponse !== "object" ||
      Array.isArray(playerResponse)
    )
      throw new Error("Invalid YouTube page response");
    const details = (playerResponse as { videoDetails?: unknown }).videoDetails;
    if (!details || typeof details !== "object" || Array.isArray(details))
      throw new Error("Invalid YouTube page response");
    const candidate = details as YouTubePageVideoDetails & {
      videoId?: unknown;
    };
    if (candidate.videoId !== videoId)
      throw new Error("Unexpected YouTube page video");
    return candidate;
  } catch {
    throw new Error("Invalid YouTube page response");
  }
}

function extractJsonObject(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, index + 1));
    }
  }
  return null;
}

function selectThumbnailUrl(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const candidate = value[index];
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      )
        continue;
      const url = safeHttpUrl((candidate as { url?: unknown }).url);
      if (url) return url;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const nestedThumbnails = (value as { thumbnails?: unknown }).thumbnails;
  if (Array.isArray(nestedThumbnails))
    return selectThumbnailUrl(nestedThumbnails);
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

function formatDescription(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
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
