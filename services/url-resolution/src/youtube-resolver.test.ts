import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));

vi.mock("../../url-unfurl-shared/src/safe-fetch", () => ({
  safeFetch: safeFetchMock,
}));

import { YouTubeOEmbedResolver } from "./youtube-resolver";

const videoId = "dQw4w9WgXcQ";

beforeEach(() => safeFetchMock.mockReset());

describe("YouTube oEmbed resolver", () => {
  it.each([
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
    `https://m.youtube.com/shorts/${videoId}`,
    `https://music.youtube.com/live/${videoId}`,
    `https://www.youtube.com/embed/${videoId}`,
  ])("matches supported public video URLs: %s", (input) => {
    expect(new YouTubeOEmbedResolver().matches(new URL(input))).toBe(true);
  });

  it.each([
    "https://www.youtube.com/watch?v=short",
    `https://www.youtube.com/playlist?list=${videoId}`,
    "https://www.youtube.com/@channel",
    `https://youtu.be/${videoId}/extra`,
    `https://example.com/watch?v=${videoId}`,
  ])("does not claim non-video or malformed URLs: %s", (input) => {
    expect(new YouTubeOEmbedResolver().matches(new URL(input))).toBe(false);
  });

  it("uses bounded oEmbed data and its reliable thumbnail", async () => {
    safeFetchMock.mockResolvedValue({
      body: new TextEncoder().encode(
        JSON.stringify({
          title: "  A video\n title ",
          author_name: "A channel",
          author_url: "https://www.youtube.com/@channel",
          thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        }),
      ),
    });

    const result = await new YouTubeOEmbedResolver().resolve(
      new URL(`https://youtu.be/${videoId}`),
    );

    expect(safeFetchMock).toHaveBeenCalledWith(
      new URL(
        `https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D${videoId}&format=json`,
      ),
      {
        accept: "application/json",
        allowedContentTypes: ["application/json"],
        maxBytes: 64 * 1024,
        totalTimeoutMs: 5_000,
      },
    );
    expect(result).toMatchObject({
      resolverKey: "youtube-oembed",
      finalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title: "A video title",
      description: null,
      siteName: "YouTube",
      resourceKind: "video",
      providerExtensions: {
        youtube: {
          videoId,
          channelName: "A channel",
          channelUrl: "https://www.youtube.com/@channel",
        },
      },
    });
    expect(result.media).toEqual([
      {
        role: "preview",
        sourceUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        sourceMetadata: "oembed:thumbnail_url",
        processingProfile: "link-preview-v1",
        alt: "A video title",
      },
    ]);
  });

  it("rejects malformed oEmbed responses so the registry can fall back", async () => {
    safeFetchMock.mockResolvedValue({
      body: new TextEncoder().encode("not json"),
    });

    await expect(
      new YouTubeOEmbedResolver().resolve(
        new URL(`https://www.youtube.com/watch?v=${videoId}`),
      ),
    ).rejects.toThrow("Invalid YouTube oEmbed response");
  });
});
