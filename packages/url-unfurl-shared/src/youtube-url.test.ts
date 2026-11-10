import { describe, expect, it } from "vitest";

import { getYouTubeVideoId, isYouTubeVideoUrl } from "./youtube-url";

const videoId = "dQw4w9WgXcQ";

describe("YouTube URL recognition", () => {
  it.each([
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtu.be/${videoId}`,
    `https://m.youtube.com/shorts/${videoId}`,
    `https://music.youtube.com/live/${videoId}`,
    `https://www.youtube.com/embed/${videoId}`,
  ])("extracts a supported video id from %s", (url) => {
    expect(getYouTubeVideoId(url)).toBe(videoId);
    expect(isYouTubeVideoUrl(url)).toBe(true);
  });

  it.each([
    "not a url",
    "https://www.youtube.com/@channel",
    `https://www.youtube.com/playlist?list=${videoId}`,
    `https://example.com/watch?v=${videoId}`,
  ])("rejects a non-video URL: %s", (url) => {
    expect(getYouTubeVideoId(url)).toBeNull();
    expect(isYouTubeVideoUrl(url)).toBe(false);
  });
});
