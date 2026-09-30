import { describe, expect, it } from "vitest";

import { isDirectVideoUrl } from "./video-url";

describe("direct video URL classification", () => {
  it.each([
    "https://example.com/movie.mp4",
    "https://example.com/movie.webm?token=abc",
    "http://example.com/MOVIE.MP4#section",
  ])("recognizes %s", (url) => {
    expect(isDirectVideoUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com/watch?v=movie.mp4",
    "https://example.com/movie.jpg?download=movie.mp4",
    "https://vimeo.com/12345",
    "file:///tmp/movie.mp4",
    "not a URL",
  ])("does not mistake %s for a direct video", (url) => {
    expect(isDirectVideoUrl(url)).toBe(false);
  });
});
