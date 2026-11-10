import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ImageAsset } from "@/types/asset";

import { ImagePeek } from "./image-peek";

describe("ImagePeek", () => {
  it("renders a compact image inspector with source, note, palette, and metadata", () => {
    const asset: ImageAsset = {
      id: "image-1",
      type: "image",
      url: "https://example.com/preview.jpg",
      originalUrl: "https://example.com/original.jpg",
      width: 1200,
      height: 800,
      alt: "A red sculpture",
      title: "Sculpture study",
      sourceLabel: "Example Gallery",
      sourceUrl: "https://example.com/gallery",
      note: "Reference for the moodboard",
      dominantColors: ["#AABBCC"],
      contentType: "image/jpeg",
      createdAt: "2025-01-01T00:00:00.000Z",
    };
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <ImagePeek
          asset={asset}
          workspaceSlug="studio"
          onAssetChange={() => {}}
          setFlushHandler={() => {}}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain('alt="A red sculpture"');
    expect(html).toContain("Sculpture study");
    expect(html).toContain("Example Gallery");
    expect(html).toContain('href="https://example.com/gallery"');
    expect(html).toContain("Notes");
    expect(html).toContain("Colors");
    expect(html).toContain("Dimensions");
    expect(html).not.toContain("Edit image");
  });
});
