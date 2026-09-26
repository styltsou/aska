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
  note: "Watch with the design team",
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
  assetCreatedAt: new Date("2026-08-31T11:00:00Z"),
  assetUpdatedAt: new Date("2026-08-31T13:00:00Z"),
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
    expect(projected.note).toBe("Watch with the design team");
    expect(projected.createdAt).toBe("2026-08-31T11:00:00.000Z");
    expect(projected.updatedAt).toBe("2026-08-31T13:00:00.000Z");
    expect(projected).not.toHaveProperty("providerExtensions");
  });

  it("omits the edit time when the asset has never been touched", () => {
    const projected = projectLinkNode(
      { ...baseRow, assetUpdatedAt: null },
      undefined,
      null,
    );

    expect(projected.updatedAt).toBeUndefined();
  });

  it("continues to project both legacy and Data API YouTube resources", () => {
    expect(
      projectLinkNode(
        {
          ...baseRow,
          resolverKey: "youtube-data-api",
          providerExtensions: {
            youtube: {
              videoId: "dQw4w9WgXcQ",
              channelName: "A channel",
              channelUrl: "https://www.youtube.com/channel/UC123",
            },
          },
        },
        undefined,
        null,
      ).video,
    ).toMatchObject({ provider: "youtube", channelName: "A channel" });
  });

  it.each(["youtube-oembed", "generic-html"])(
    "suppresses a legacy YouTube description from %s",
    (resolverKey) => {
      expect(
        projectLinkNode(
          {
            ...baseRow,
            resolverKey,
            description: "Enjoy the videos and music you love.",
          },
          undefined,
          null,
        ).description,
      ).toBeNull();
    },
  );

  it("keeps the video-specific Data API description", () => {
    expect(
      projectLinkNode(
        {
          ...baseRow,
          resolverKey: "youtube-data-api",
          description: "The actual video description.",
        },
        undefined,
        null,
      ).description,
    ).toBe("The actual video description.");
  });

  it("uses a friendly title when YouTube has no title metadata", () => {
    expect(
      projectLinkNode(
        { ...baseRow, resourceTitle: null, resolverKey: "youtube-data-api" },
        undefined,
        null,
      ).title,
    ).toBe("Title unavailable");
  });

  it("keeps notes scoped to the saved link asset", () => {
    expect(projectLinkNode(baseRow, undefined, null).note).toBe(
      "Watch with the design team",
    );
    expect(
      projectLinkNode(
        { ...baseRow, assetId: 8, note: "Review the editing style" },
        undefined,
        null,
      ).note,
    ).toBe("Review the editing style");
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
