import { describe, expect, it } from "vitest";

import { projectLinkNode, type LinkProjectionRow } from "./projection";

const baseRow: LinkProjectionRow = {
  assetId: 7,
  originalUrl: "https://youtu.be/dQw4w9WgXcQ",
  resourceId: 11,
  hostname: "youtu.be",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  resourceTitle: "A video",
  description: null,
  siteName: "YouTube",
  resourceKind: "video",
  resolverKey: "youtube-oembed",
  providerExtensions: {
    youtube: {
      videoId: "dQw4w9WgXcQ",
      channelName: "A channel",
      channelUrl: "https://www.youtube.com/@channel",
    },
  },
  resolutionStatus: "ready",
  failureCategory: null,
  resolvedAt: new Date("2026-08-31T12:00:00Z"),
  staleAt: null,
  createdAt: new Date("2026-08-31T11:00:00Z"),
};

describe("link projection", () => {
  it("allowlists validated YouTube video data", () => {
    const projected = projectLinkNode(baseRow, undefined, null);

    expect(projected.video).toEqual({
      provider: "youtube",
      videoId: "dQw4w9WgXcQ",
      channelName: "A channel",
      channelUrl: "https://www.youtube.com/@channel",
    });
    expect(projected).not.toHaveProperty("providerExtensions");
  });

  it.each([
    {
      resolverKey: "generic-html",
    },
    {
      providerExtensions: {
        youtube: {
          videoId: "invalid",
          channelName: "A channel",
          channelUrl: "https://www.youtube.com/@channel",
        },
      },
    },
    {
      providerExtensions: {
        youtube: {
          videoId: "dQw4w9WgXcQ",
          channelName: "A channel",
          channelUrl: "https://malicious.example/channel",
        },
      },
    },
  ])("does not expose invalid provider data: %#", (override) => {
    expect(
      projectLinkNode({ ...baseRow, ...override }, undefined, null).video,
    ).toBeNull();
  });
});
