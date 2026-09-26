import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));

vi.mock("../../url-unfurl-shared/src/safe-fetch", () => ({
  safeFetch: safeFetchMock,
}));

import { YouTubeDataApiResolver } from "./youtube-resolver";

const videoId = "dQw4w9WgXcQ";

beforeEach(() => safeFetchMock.mockReset());

describe("YouTube Data API resolver", () => {
  it.each([
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
    `https://m.youtube.com/shorts/${videoId}`,
    `https://music.youtube.com/live/${videoId}`,
    `https://www.youtube.com/embed/${videoId}`,
  ])("matches supported public video URLs: %s", (input) => {
    expect(new YouTubeDataApiResolver("test-key").matches(new URL(input))).toBe(
      true,
    );
  });

  it.each([
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/playlist?list=${videoId}`,
    "https://www.youtube.com/@channel",
    `https://youtu.be/${videoId}/extra`,
    `https://example.com/watch?v=${videoId}`,
  ])("does not claim non-video or malformed URLs: %s", (input) => {
    expect(new YouTubeDataApiResolver("test-key").matches(new URL(input))).toBe(
      false,
    );
  });

  it("persists video-specific metadata and the best available thumbnail", async () => {
    safeFetchMock.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          items: [
            {
              id: videoId,
              snippet: {
                title: "  A video\n title ",
                description: " First paragraph.\n\nSecond\t paragraph. ",
                channelId: "UC123",
                channelTitle: "A channel",
                thumbnails: {
                  high: { url: "https://i.ytimg.com/vi/high.jpg" },
                  maxres: { url: "https://i.ytimg.com/vi/maxres.jpg" },
                },
              },
            },
          ],
        }),
      ),
    });

    const result = await new YouTubeDataApiResolver("test-key").resolve(
      new URL(`https://youtu.be/${videoId}`),
    );

    const [endpoint, options] = safeFetchMock.mock.calls[0] as [URL, unknown];
    expect(endpoint.origin).toBe("https://www.googleapis.com");
    expect(endpoint.pathname).toBe("/youtube/v3/videos");
    expect(endpoint.searchParams.get("part")).toBe("snippet");
    expect(endpoint.searchParams.get("id")).toBe(videoId);
    expect(endpoint.searchParams.get("key")).toBe("test-key");
    expect(options).toEqual({
      accept: "application/json",
      allowedContentTypes: ["application/json"],
      maxBytes: 128 * 1024,
      totalTimeoutMs: 5_000,
    });
    expect(result).toMatchObject({
      resolverKey: "youtube-data-api",
      resolverVersion: "3",
      finalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: "A video title",
      description: "First paragraph.\n\nSecond paragraph.",
      siteName: "YouTube",
      resourceKind: "video",
      providerExtensions: {
        youtube: {
          videoId,
          channelName: "A channel",
          channelUrl: "https://www.youtube.com/channel/UC123",
        },
      },
    });
    expect(result.media).toEqual([
      {
        role: "preview",
        sourceUrl: "https://i.ytimg.com/vi/maxres.jpg",
        sourceMetadata: "youtube:data-api:thumbnail",
        processingProfile: "link-preview-v2",
        alt: "A video title",
      },
    ]);
  });

  it("uses the YouTube page payload when the Data API is unavailable", async () => {
    safeFetchMock
      .mockResolvedValueOnce({
        body: new TextEncoder().encode("not json"),
      })
      .mockResolvedValueOnce({
        body: new TextEncoder().encode(
          `<script>var ytInitialPlayerResponse = ${JSON.stringify({
            videoDetails: {
              videoId,
              title: "Fallback title",
              shortDescription:
                "First fallback paragraph.\n\nSecond fallback paragraph.",
              author: "Fallback channel",
              channelId: "UC123",
              thumbnail: {
                thumbnails: [
                  { url: "https://i.ytimg.com/vi/small.jpg" },
                  { url: "https://i.ytimg.com/vi/fallback.jpg" },
                ],
              },
            },
          })};</script>`,
        ),
      });

    const result = await new YouTubeDataApiResolver("test-key").resolve(
      new URL(`https://www.youtube.com/watch?v=${videoId}`),
    );

    expect(result).toMatchObject({
      resolverKey: "youtube-data-api",
      title: "Fallback title",
      description: "First fallback paragraph.\n\nSecond fallback paragraph.",
      resourceKind: "video",
      providerExtensions: {
        youtube: {
          videoId,
          channelName: "Fallback channel",
          channelUrl: "https://www.youtube.com/channel/UC123",
        },
      },
    });
    expect(result.media[0]).toMatchObject({
      sourceUrl: "https://i.ytimg.com/vi/fallback.jpg",
      sourceMetadata: "youtube:page:thumbnail",
    });
    const [endpoint, options] = safeFetchMock.mock.calls[1] as [URL, unknown];
    expect(endpoint.origin).toBe("https://www.youtube.com");
    expect(endpoint.pathname).toBe("/watch");
    expect(endpoint.searchParams.get("v")).toBe(videoId);
    expect(options).toMatchObject({
      maxBytes: 2 * 1024 * 1024,
      bodyMode: "full",
    });
  });

  it("uses the YouTube page payload when no Data API key is configured", async () => {
    safeFetchMock.mockResolvedValue({
      body: new TextEncoder().encode(
        `<script>ytInitialPlayerResponse = ${JSON.stringify({
          videoDetails: {
            videoId,
            title: "Fallback title",
            shortDescription: "A fallback description.",
          },
        })};</script>`,
      ),
    });

    const result = await new YouTubeDataApiResolver(undefined).resolve(
      new URL(`https://www.youtube.com/watch?v=${videoId}`),
    );

    expect(safeFetchMock).toHaveBeenCalledOnce();
    expect(result.title).toBe("Fallback title");
    expect(result.description).toBe("A fallback description.");
    expect(result.media[0]?.sourceUrl).toBe(
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    );
  });

  it("uses the minimal result only when both YouTube sources fail", async () => {
    safeFetchMock.mockResolvedValue({
      body: new TextEncoder().encode("not json"),
    });

    const result = await new YouTubeDataApiResolver("test-key").resolve(
      new URL(`https://www.youtube.com/watch?v=${videoId}`),
    );

    expect(safeFetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ title: null, description: null });
    expect(result.media[0]).toMatchObject({
      sourceUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      sourceMetadata: "youtube:fallback:hqdefault",
    });
  });
});
