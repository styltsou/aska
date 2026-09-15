import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { LinkAsset } from "@/types/asset";
import { shouldShowLinkPreviewRefresh } from "../asset-context-menu";
import {
  handleLinkCardNavigationClick,
  LinkAssetCard,
  LinkCardPreview,
} from "./link-asset-card";

const asset: LinkAsset = {
  id: "link-7",
  type: "link",
  originalUrl: "https://youtu.be/dQw4w9WgXcQ",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  hostname: "youtu.be",
  title: "A video",
  siteName: "YouTube",
  resourceKind: "video",
  resolutionStatus: "ready",
  video: {
    provider: "youtube",
    videoId: "dQw4w9WgXcQ",
    channelName: "A channel",
    channelUrl: "https://www.youtube.com/@channel",
  },
};

describe("LinkAssetCard", () => {
  it("lets modifier-click bubble for card selection without navigating", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    handleLinkCardNavigationClick({
      ctrlKey: true,
      metaKey: false,
      preventDefault,
      stopPropagation,
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it("keeps ordinary clicks isolated so the anchor can navigate", () => {
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    handleLinkCardNavigationClick({
      ctrlKey: false,
      metaKey: false,
      preventDefault,
      stopPropagation,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it("turns a resolved YouTube card into a video-details action", () => {
    const html = renderToStaticMarkup(
      <LinkAssetCard asset={asset} onOpen={() => undefined} />,
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Open video details: A video"');
    expect(html).toContain('aria-label="Open on YouTube in a new tab"');
    expect(html).toContain("aspect-video w-full");
    expect(html).not.toContain("aspect-square");
    expect(html).toContain("bg-sidebar");
    expect(html).toContain('class="min-h-0 p-3"');
    expect(html).toContain("space-y-1 bg-sidebar px-3 pb-3");
    expect(html).toContain("overflow-hidden rounded-sm bg-muted/40");
    expect(html).toContain("bg-popover/85");
    expect(html).toContain("text-popover-foreground");
    expect(html).toContain(`href="${asset.originalUrl}"`);
  });

  it("keeps an ordinary link card as an external anchor", () => {
    const html = renderToStaticMarkup(
      <LinkAssetCard
        asset={{
          ...asset,
          originalUrl: "https://example.com/article",
          video: undefined,
          hostname: "example.com",
          previewImage: {
            url: "https://example.com/preview.jpg",
            width: 1200,
            height: 630,
          },
        }}
      />,
    );

    expect(html.startsWith('<a href="https://example.com/article"')).toBe(true);
    expect(html).not.toContain("Open video details");
    expect(html).toContain("group relative block w-full");
    expect(html).toContain("aspect-video w-full");
    expect(html).toContain("bg-sidebar");
    expect(html).toContain("group-hover:scale-[1.05]");
    expect(html).toContain("!transition-all duration-150 ease-out");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("absolute top-2 right-2 z-10 flex size-7");
    expect(html).toContain(
      "transition-[background-color,opacity] duration-150",
    );
  });

  it("uses a 16:9 shimmer placeholder while a generic preview resolves", () => {
    const html = renderToStaticMarkup(
      <LinkAssetCard
        asset={{
          ...asset,
          video: undefined,
          hostname: "example.com",
          resolutionStatus: "resolving",
        }}
      />,
    );

    expect(html).toContain("aspect-video w-full");
    expect(html).toContain('data-slot="optimistic-link-preview"');
    expect(html).toContain(
      "animate-[link-preview-shimmer_1.6s_linear_infinite]",
    );
    expect(html).not.toContain("Resolving");
  });

  it("reserves a 16:9 frame for a pending YouTube URL before it resolves", () => {
    const html = renderToStaticMarkup(
      <LinkAssetCard
        asset={{ ...asset, video: undefined, resolutionStatus: "queued" }}
      />,
    );

    expect(html).toContain("aspect-video w-full");
    expect(html).toContain(
      "animate-[link-preview-shimmer_1.6s_linear_infinite]",
    );
    expect(html).not.toContain("group-hover:scale-[1.05]");
  });

  it("offers preview refresh only after an unfurl failure", () => {
    expect(shouldShowLinkPreviewRefresh({ ...asset, video: undefined })).toBe(
      false,
    );
    expect(
      shouldShowLinkPreviewRefresh({
        ...asset,
        video: undefined,
        resolutionStatus: "failed",
      }),
    ).toBe(true);
    expect(
      shouldShowLinkPreviewRefresh({
        ...asset,
        video: undefined,
        resolutionStatus: "partial",
      }),
    ).toBe(false);
    expect(
      shouldShowLinkPreviewRefresh({
        ...asset,
        video: undefined,
        resolutionStatus: "failed",
        failureCategory: "credentials",
      }),
    ).toBe(false);
  });
});

describe("LinkCardPreview", () => {
  it("renders a YouTube thumbnail with a play badge from the video id", () => {
    const html = renderToStaticMarkup(
      <LinkCardPreview
        preview={{
          type: "link",
          assetId: "link-7",
          hostname: "www.youtube.com",
          title: "A video",
          videoId: "dQw4w9WgXcQ",
        }}
      />,
    );

    expect(html).toContain("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(html).toContain("lucide-play");
    expect(html).toContain("bg-popover/85");
    expect(html).toContain("A video");
    expect(html).toContain("www.youtube.com");
    expect(html).not.toContain("scale(");
  });

  it("renders the title, description, and site footer at natural card sizes", () => {
    const html = renderToStaticMarkup(
      <LinkCardPreview
        preview={{
          type: "link",
          assetId: "link-8",
          hostname: "example.com",
          title: "An article",
          description: "A thorough writeup about the topic.",
          url: "https://example.com/preview.jpg",
          favicon: "https://example.com/favicon.ico",
        }}
      />,
    );

    expect(html).toContain("aspect-video");
    expect(html).toContain("A thorough writeup about the topic.");
    expect(html).toContain("https://example.com/preview.jpg");
    expect(html).toContain("https://example.com/favicon.ico");
    expect(html).not.toContain("lucide-play");
    expect(html).not.toContain("i.ytimg.com");
  });

  it("falls back to a globe tile when no thumbnail is resolved", () => {
    const html = renderToStaticMarkup(
      <LinkCardPreview
        preview={{
          type: "link",
          assetId: "link-9",
          hostname: "example.com",
        }}
      />,
    );

    expect(html).toContain("size-8 text-muted-foreground/40");
    expect(html).not.toContain("i.ytimg.com");
    expect(html).toContain("Untitled link");
  });
});
