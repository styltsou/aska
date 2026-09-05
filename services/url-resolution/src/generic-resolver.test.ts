import { beforeEach, describe, expect, it, vi } from "vitest";

const { safeFetchMock } = vi.hoisted(() => ({ safeFetchMock: vi.fn() }));

vi.mock("../../url-unfurl-shared/src/safe-fetch", () => ({
  safeFetch: safeFetchMock,
}));

import { GenericHtmlResolver } from "./generic-resolver";

beforeEach(() => safeFetchMock.mockReset());

describe("generic HTML resolver", () => {
  it("discovers Open Graph preview media from fetched HTML", async () => {
    safeFetchMock.mockResolvedValue({
      body: new TextEncoder().encode(`
        <html><head>
          <meta property="og:title" content="Resolved title">
          <meta property="og:image" content="/social-card.jpg">
          <link rel="icon" href="/favicon.png">
        </head></html>
      `),
      contentType: "text/html",
      finalUrl: "https://example.com/article",
      status: 200,
      redirectCount: 0,
    });

    const result = await new GenericHtmlResolver().resolve(
      new URL("https://example.com/article"),
    );

    expect(safeFetchMock).toHaveBeenCalledWith(
      new URL("https://example.com/article"),
      expect.objectContaining({
        maxBytes: 1024 * 1024,
        bodyMode: "html-head",
      }),
    );
    expect(result.title).toBe("Resolved title");
    expect(result.media).toEqual([
      {
        role: "preview",
        sourceUrl: "https://example.com/social-card.jpg",
        sourceMetadata: "og:image",
        processingProfile: "link-preview-v1",
        alt: null,
      },
      {
        role: "icon",
        sourceUrl: "https://example.com/favicon.png",
        sourceMetadata: "link:icon",
        processingProfile: "icon-v1",
      },
    ]);
  });
});
