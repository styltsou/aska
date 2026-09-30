import { describe, expect, it } from "vitest";

import { inferVideoMime, isDirectVideoUrl } from "./video-url";

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

describe("video file MIME inference", () => {
  it("accepts a recognized MIME or file extension", () => {
    expect(inferVideoMime({ name: "clip.bin", type: "video/webm" })).toBe(
      "video/webm",
    );
    expect(
      inferVideoMime({ name: "clip.MP4", type: "application/octet-stream" }),
    ).toBe("video/mp4");
    expect(inferVideoMime({ name: "clip.webm", type: "" })).toBe("video/webm");
  });

  it("rejects files without a supported MIME or extension", () => {
    expect(
      inferVideoMime({ name: "clip.mov", type: "video/quicktime" }),
    ).toBeNull();
  });
});
