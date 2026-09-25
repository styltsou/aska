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
                description: "A specific video description",
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
      finalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: "A video title",
      description: "A specific video description",
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

  it("uses the minimal YouTube result when the API is unavailable", async () => {
    safeFetchMock.mockResolvedValue({
      body: new TextEncoder().encode("not json"),
    });

    const result = await new YouTubeDataApiResolver("test-key").resolve(
      new URL(`https://www.youtube.com/watch?v=${videoId}`),
    );

    expect(result).toMatchObject({
      resolverKey: "youtube-data-api",
      title: null,
      description: null,
      resourceKind: "video",
      providerExtensions: {
        youtube: { videoId, channelName: null, channelUrl: null },
      },
    });
    expect(result.media[0]).toMatchObject({
      sourceUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      sourceMetadata: "youtube:fallback:hqdefault",
    });
  });

  it("uses the same minimal result when no API key is configured", async () => {
    const result = await new YouTubeDataApiResolver(undefined).resolve(
      new URL(`https://www.youtube.com/watch?v=${videoId}`),
    );

    expect(safeFetchMock).not.toHaveBeenCalled();
    expect(result.description).toBeNull();
    expect(result.media[0]?.sourceUrl).toBe(
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    );
  });
});
