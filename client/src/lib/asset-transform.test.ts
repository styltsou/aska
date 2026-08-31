import { describe, expect, it } from "vitest";

import { collectionNodeToAsset } from "./asset-transform";

describe("collectionNodeToAsset", () => {
  it("keeps allowlisted video data when converting a link node", () => {
    const video = {
      provider: "youtube" as const,
      videoId: "dQw4w9WgXcQ",
      channelName: "A channel",
      channelUrl: "https://www.youtube.com/@channel",
    };
    const asset = collectionNodeToAsset({
      id: "link-1",
      type: "link",
      originalUrl: "https://youtu.be/dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      hostname: "youtu.be",
      title: "A video",
      description: null,
      note: "Watch with the design team",
      siteName: "YouTube",
      resourceKind: "video",
      resolutionStatus: "ready",
      failureCategory: null,
      resolvedAt: "2026-08-31T12:00:00.000Z",
      staleAt: null,
      previewImage: null,
      favicon: null,
      video,
      createdAt: "2026-08-31T11:00:00.000Z",
      position: null,
    });

    expect(asset).toMatchObject({
      type: "link",
      video,
      note: "Watch with the design team",
    });
  });

  it("keeps a color gradient when converting a collection node for a card", () => {
    const asset = collectionNodeToAsset({
      id: "color-1",
      type: "color",
      hex: "#f43f5e",
      gradient: {
        from: "#f43f5e",
        to: "#7c3aed",
        angle: 135,
        type: "linear",
        stops: [
          { color: "#f43f5e", position: 0 },
          { color: "#7c3aed", position: 100 },
        ],
      },
      title: null,
      isFavorite: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      position: null,
    });

    expect(asset).toMatchObject({
      type: "color",
      gradient: {
        to: "#7c3aed",
        stops: [
          { color: "#f43f5e", position: 0 },
          { color: "#7c3aed", position: 100 },
        ],
      },
    });
  });
});
