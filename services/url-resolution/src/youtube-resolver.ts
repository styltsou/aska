import { safeFetch } from "../../url-unfurl-shared/src/safe-fetch";
import type { ResolverResult, UrlResolver } from "./types";

const OEMBED_ORIGIN = "https://www.youtube.com";
const MAX_OEMBED_BYTES = 64 * 1024;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

type YouTubeOEmbed = {
  title?: unknown;
  author_name?: unknown;
  author_url?: unknown;
  thumbnail_url?: unknown;
};

export class YouTubeOEmbedResolver implements UrlResolver {
  readonly key = "youtube-oembed";
  readonly version = "1";
  readonly continueAfterResolve = true;

  matches(url: URL): boolean {
    return extractVideoId(url) !== null;
  }

  async resolve(url: URL): Promise<ResolverResult> {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Unsupported YouTube video URL");

    const canonicalUrl = canonicalVideoUrl(videoId);
    const oembedUrl = new URL("/oembed", OEMBED_ORIGIN);
    oembedUrl.searchParams.set("url", canonicalUrl);
    oembedUrl.searchParams.set("format", "json");
    const response = await safeFetch(oembedUrl, {
      accept: "application/json",
      allowedContentTypes: ["application/json"],
      maxBytes: MAX_OEMBED_BYTES,
      totalTimeoutMs: 5_000,
    });
    const metadata = parseOEmbed(response.body);
    const title = boundedText(metadata.title, 255);
    const channelName = boundedText(metadata.author_name, 255);
    const channelUrl = safeHttpUrl(metadata.author_url);
    const thumbnailUrl = safeHttpUrl(metadata.thumbnail_url);

    return {
      resolverKey: this.key,
      resolverVersion: this.version,
      finalUrl: canonicalUrl,
      canonicalUrl,
      title,
      description: null,
      siteName: "YouTube",
      resourceKind: "video",
      fieldProvenance: {
        title: { resolver: this.key, source: "oembed:title" },
        siteName: { resolver: this.key, source: "provider:youtube" },
        resourceKind: { resolver: this.key, source: "provider:youtube" },
        canonicalUrl: { resolver: this.key, source: "url:video-id" },
      },
      providerExtensions: {
        youtube: {
          videoId,
          channelName,
          channelUrl,
        },
      },
      media: thumbnailUrl
        ? [
            {
              role: "preview",
              sourceUrl: thumbnailUrl,
              sourceMetadata: "oembed:thumbnail_url",
              processingProfile: "link-preview-v1",
              alt: title,
            },
          ]
        : [],
    };
  }
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
  return `${OEMBED_ORIGIN}/watch?v=${videoId}`;
}

function parseOEmbed(body: Uint8Array): YouTubeOEmbed {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("Invalid YouTube oEmbed response");
    return parsed as YouTubeOEmbed;
  } catch {
    throw new Error("Invalid YouTube oEmbed response");
  }
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
