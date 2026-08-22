import { describe, expect, it } from "vitest";

import { collectionNodeToAsset } from "./asset-transform";

describe("collectionNodeToAsset", () => {
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
