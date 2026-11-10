import { describe, expect, it } from "vitest";

import { createOptimisticLink } from "./hooks";

describe("createOptimisticLink", () => {
  it("creates an immediate usable hostname card without resolved fields", () => {
    expect(
      createOptimisticLink(
        "https://example.com/reference?id=4",
        "link-optimistic-1",
      ),
    ).toMatchObject({
      id: "link-optimistic-1",
      type: "link",
      originalUrl: "https://example.com/reference?id=4",
      hostname: "example.com",
      title: "example.com",
      resolutionStatus: "queued",
      note: null,
      previewImage: null,
      favicon: null,
      video: null,
    });
  });

  it("creates an immediate YouTube thumbnail and metadata skeleton state", () => {
    expect(
      createOptimisticLink(
        "https://youtu.be/dQw4w9WgXcQ",
        "link-optimistic-youtube",
      ),
    ).toMatchObject({
      resourceKind: "video",
      siteName: "YouTube",
      previewImage: {
        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        width: 480,
        height: 360,
      },
      optimisticYouTube: {
        videoId: "dQw4w9WgXcQ",
        channelName: null,
        metadataStatus: "loading",
      },
    });
  });
});
