import { describe, expect, it } from "vitest";

import { parseHtmlMetadata } from "./html-metadata";

describe("generic HTML metadata", () => {
  it("applies Open Graph, Twitter, and standard precedence per field", () => {
    const result = parseHtmlMetadata(`
      <html><head>
        <title>HTML title</title>
        <meta name="description" content="HTML description">
        <meta name="twitter:title" content="Twitter title">
        <meta name="twitter:description" content="Twitter description">
        <meta property="og:title" content="OG title">
        <meta property="og:image" content="/preview.jpg">
        <link rel="canonical" href="/canonical">
        <link rel="icon" sizes="32x32" href="/favicon.png">
      </head><body><meta property="og:title" content="Ignored"></body></html>
    `);
    expect(result.title).toEqual({ value: "OG title", source: "og:title" });
    expect(result.description).toEqual({
      value: "Twitter description",
      source: "twitter:description",
    });
    expect(result.previewUrl?.value).toBe("/preview.jpg");
    expect(result.canonicalUrl?.value).toBe("/canonical");
    expect(result.faviconUrl?.value).toBe("/favicon.png");
  });

  it("normalizes malformed whitespace and bounds metadata", () => {
    const result = parseHtmlMetadata(
      `<head><meta property="og:title" content="  A\n\t title  "><meta name="description" content="${"x".repeat(3000)}"></head>`,
    );
    expect(result.title?.value).toBe("A title");
    expect(result.description?.value).toHaveLength(2000);
  });

  it("accepts head metadata from malformed documents without a head element", () => {
    expect(
      parseHtmlMetadata(
        '<meta property="og:title" content="Headless title"><body><meta property="og:title" content="Body title"></body>',
      ).title,
    ).toEqual({ value: "Headless title", source: "og:title" });
  });

  it("falls back cleanly when metadata is absent", () => {
    expect(
      parseHtmlMetadata("<html><head></head><body>Body</body></html>"),
    ).toEqual({
      title: undefined,
      description: undefined,
      siteName: undefined,
      canonicalUrl: undefined,
      previewUrl: undefined,
      previewAlt: undefined,
      faviconUrl: undefined,
      resourceKind: undefined,
    });
  });
});
