import { describe, expect, it } from "vitest";

import { extractYouTubeVideoId, isYouTubeVideoUrl } from "./youtube-url";

describe("isYouTubeVideoUrl", () => {
  it.each([
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    "https://music.youtube.com/live/dQw4w9WgXcQ",
    "https://youtube.com/embed/dQw4w9WgXcQ",
  ])("recognizes supported video URLs: %s", (url) => {
    expect(isYouTubeVideoUrl(url)).toBe(true);
  });

  it.each([
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@channel",
    "https://youtu.be/dQw4w9WgXcQ/extra",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "not a URL",
  ])("rejects non-video URLs: %s", (url) => {
    expect(isYouTubeVideoUrl(url)).toBe(false);
  });
});

describe("extractYouTubeVideoId", () => {
  it("returns the normalized ID for each supported URL shape", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("does not extract IDs from unsupported YouTube URLs", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/playlist?list=PL123"),
    ).toBeNull();
  });
});
