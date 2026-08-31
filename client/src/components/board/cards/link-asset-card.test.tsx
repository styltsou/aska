import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { LinkAsset } from "@/types/asset";
import { LinkAssetCard } from "./link-asset-card";

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
  it("turns a resolved YouTube card into a video-details action", () => {
    const html = renderToStaticMarkup(
      <LinkAssetCard asset={asset} onOpen={() => undefined} />,
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Open video details: A video"');
    expect(html).toContain('aria-label="Open on YouTube in a new tab"');
    expect(html).toContain("bg-popover/85");
    expect(html).toContain("text-popover-foreground");
    expect(html).toContain(`href="${asset.originalUrl}"`);
  });

  it("keeps an ordinary link card as an external anchor", () => {
    const html = renderToStaticMarkup(
      <LinkAssetCard asset={{ ...asset, video: undefined }} />,
    );

    expect(html.startsWith(`<a href="${asset.originalUrl}"`)).toBe(true);
    expect(html).not.toContain("Open video details");
  });
});
