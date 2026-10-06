import { describe, expect, it, vi } from "vitest";

import {
  isDirectImageUrl,
  resolveUrlAsset,
  toResolvedRemoteImageInput,
} from "./url-asset-kind";

describe("isDirectImageUrl", () => {
  it.each([
    "https://example.com/photo.jpg",
    "https://example.com/photo.JPEG?download=1",
    "http://example.com/photo.webp#preview",
  ])("recognizes a supported image path: %s", (url) => {
    expect(isDirectImageUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com/photo.svg",
    "https://example.com/article?image=photo.jpg",
    "javascript:alert(1)",
  ])("rejects a non-importable image path: %s", (url) => {
    expect(isDirectImageUrl(url)).toBe(false);
  });
});

describe("resolveUrlAsset", () => {
  it("prioritizes direct image paths without an inspection round trip", async () => {
    const inspect = vi.fn();

    await expect(
      resolveUrlAsset("https://example.com/photo.jpg", inspect),
    ).resolves.toEqual({ kind: "image", url: "https://example.com/photo.jpg" });
    expect(inspect).not.toHaveBeenCalled();
  });

  it("recognizes extensionless Unsplash CDN images by content type", async () => {
    const inspect = vi.fn().mockResolvedValue({
      kind: "image" as const,
      contentType: "image/jpeg",
    });
    const url =
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200";

    await expect(resolveUrlAsset(url, inspect)).resolves.toEqual({
      kind: "image",
      url,
    });
    expect(inspect).toHaveBeenCalledWith(url);
  });

  it("uses a resolved Unsplash photo as an image with its page as the source", async () => {
    const pageUrl = "https://unsplash.com/photos/a-photo-JmuyB_LibRo";
    const imageUrl =
      "https://images.unsplash.com/photo-1624138784614-87fd1b6528f8?w=1633";
    const inspect = vi.fn().mockResolvedValue({
      kind: "image" as const,
      contentType: "image/jpeg",
      url: imageUrl,
      sourceUrl: pageUrl,
      title: "Sydney opera house",
      alt: "Sydney opera house",
    });

    const resolved = await resolveUrlAsset(pageUrl, inspect);
    expect(resolved).toEqual({
      kind: "image",
      url: imageUrl,
      sourceUrl: pageUrl,
      title: "Sydney opera house",
      alt: "Sydney opera house",
    });
    if (resolved.kind !== "image") throw new Error("Expected an image");
    expect(toResolvedRemoteImageInput(pageUrl, resolved)).toEqual({
      url: imageUrl,
      title: "Sydney opera house",
      alt: "Sydney opera house",
      provenance: { provider: "url", url: pageUrl },
    });
  });

  it("leaves normal and unresolvable pages to generic URL unfurling", async () => {
    const inspect = vi.fn().mockRejectedValue(new Error("Not media"));

    await expect(
      resolveUrlAsset("https://unsplash.com/s/photos/nature", inspect),
    ).resolves.toEqual({ kind: "link" });
  });

  it("leaves YouTube URLs to the YouTube unfurler without inspection", async () => {
    const inspect = vi.fn();

    await expect(
      resolveUrlAsset("https://www.youtube.com/watch?v=dQw4w9WgXcQ", inspect),
    ).resolves.toEqual({ kind: "link" });
    expect(inspect).not.toHaveBeenCalled();
  });
});
