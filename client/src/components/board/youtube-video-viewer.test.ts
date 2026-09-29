import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { YouTubeDescription } from "./youtube-description";
import {
  formatVideoEditedLabel,
  youtubeEmbedUrl,
} from "./youtube-video-viewer";
import {
  parseYouTubeDescription,
  youtubeTimestampUrl,
} from "./youtube-description";
import { createYouTubePlayerSeekController } from "./youtube-player-seek";
import { hasAssetBeenEdited } from "./asset-timestamp-card";

describe("youtubeEmbedUrl", () => {
  it("constructs a paused privacy-enhanced player URL", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1&enablejsapi=1",
    );
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).not.toContain("autoplay");
    expect(youtubeEmbedUrl("dQw4w9WgXcQ", "https://aska.test")).toContain(
      "origin=https%3A%2F%2Faska.test",
    );
  });
});

describe("parseYouTubeDescription", () => {
  it("recognizes links and timestamps while preserving other text and line breaks", () => {
    expect(
      parseYouTubeDescription(
        "Intro at 1:23\nLong section 1:02:03\nSee https://example.com/page.",
      ),
    ).toEqual([
      { type: "text", value: "Intro at " },
      { type: "timestamp", value: "1:23", seconds: 83 },
      { type: "text", value: "\nLong section " },
      { type: "timestamp", value: "1:02:03", seconds: 3723 },
      { type: "text", value: "\nSee " },
      {
        type: "link",
        value: "https://example.com/page",
        href: "https://example.com/page",
      },
      { type: "text", value: "." },
    ]);
  });

  it("normalizes www links and leaves unsafe schemes and invalid timestamps as text", () => {
    expect(
      parseYouTubeDescription("www.example.com javascript:alert(1) 1:99"),
    ).toEqual([
      {
        type: "link",
        value: "www.example.com",
        href: "https://www.example.com/",
      },
      { type: "text", value: " javascript:alert(1) 1:99" },
    ]);
  });
});

describe("youtubeTimestampUrl", () => {
  it("creates a timestamped YouTube watch URL", () => {
    expect(youtubeTimestampUrl("dQw4w9WgXcQ", 83)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83",
    );
  });
});

describe("YouTube description hashtags", () => {
  it("recognizes Unicode hashtags without mistaking email-like text", () => {
    expect(
      parseYouTubeDescription("Topics #research #δοκιμή user#name"),
    ).toEqual([
      { type: "text", value: "Topics " },
      { type: "hashtag", value: "#research" },
      { type: "text", value: " " },
      { type: "hashtag", value: "#δοκιμή" },
      { type: "text", value: " user#name" },
    ]);
  });
});

describe("YouTubeDescription viewer rendering", () => {
  it("keeps description URLs and timestamps interactive by default", () => {
    const html = renderToStaticMarkup(
      createElement(YouTubeDescription, {
        description: "Jump to 1:23 or visit https://example.com",
        videoId: "dQw4w9WgXcQ",
      }),
    );

    expect(html).toContain(
      'href="https://www.youtube.com/watch?v=dQw4w9WgXcQ&amp;t=83"',
    );
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("hover:text-foreground");
    expect(html).toContain("transition-colors duration-100");
    expect(html).toContain("ease-[cubic-bezier(0.16,1,0.3,1)]");
  });
});

describe("YouTube player timestamp seeking", () => {
  it("seeks immediately when the player is ready", () => {
    const seekTo = vi.fn();
    const controller = createYouTubePlayerSeekController();
    controller.setReady({ seekTo });

    expect(controller.seek(83)).toBe(true);
    expect(seekTo).toHaveBeenCalledWith(83, true);
  });

  it("queues the latest timestamp until the player is ready", () => {
    const seekTo = vi.fn();
    const controller = createYouTubePlayerSeekController();
    expect(controller.seek(15)).toBe(true);
    expect(controller.seek(83)).toBe(true);
    expect(seekTo).not.toHaveBeenCalled();

    controller.setReady({ seekTo });
    expect(seekTo).toHaveBeenCalledTimes(1);
    expect(seekTo).toHaveBeenCalledWith(83, true);
  });

  it("leaves timestamp links to their YouTube fallback when unavailable", () => {
    const controller = createYouTubePlayerSeekController();
    controller.setUnavailable();
    expect(controller.seek(83)).toBe(false);
  });
});

describe("hasAssetBeenEdited", () => {
  const createdAt = "2026-09-05T09:00:00.000Z";

  it("ignores the insert timestamps a new asset starts with", () => {
    expect(hasAssetBeenEdited(createdAt, createdAt)).toBe(false);
    expect(hasAssetBeenEdited(createdAt, "2026-09-05T09:00:00.400Z")).toBe(
      false,
    );
    expect(hasAssetBeenEdited(createdAt, undefined)).toBe(false);
    expect(hasAssetBeenEdited(createdAt, "not-a-date")).toBe(false);
  });

  it("accepts a later write", () => {
    expect(hasAssetBeenEdited(createdAt, "2026-09-05T11:30:00.000Z")).toBe(
      true,
    );
    expect(hasAssetBeenEdited(undefined, "2026-09-05T11:30:00.000Z")).toBe(
      true,
    );
  });
});

describe("formatVideoEditedLabel", () => {
  const now = new Date("2026-09-05T12:00:00.000Z").getTime();
  const createdAt = "2026-09-05T09:00:00.000Z";

  it("reports the note edit time", () => {
    expect(
      formatVideoEditedLabel("2026-09-05T11:30:00.000Z", createdAt, now),
    ).toBe("Edited 30m ago");
  });

  it("stays hidden for a link nobody has edited", () => {
    expect(formatVideoEditedLabel(undefined, createdAt, now)).toBeUndefined();
    expect(formatVideoEditedLabel(createdAt, createdAt, now)).toBeUndefined();
    expect(
      formatVideoEditedLabel("2026-09-05T09:00:00.400Z", createdAt, now),
    ).toBeUndefined();
  });

  it("reports an edit even without a creation time to compare against", () => {
    expect(
      formatVideoEditedLabel("2026-09-05T11:30:00.000Z", undefined, now),
    ).toBe("Edited 30m ago");
  });
});
