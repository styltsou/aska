import { describe, expect, it } from "vitest";

import { youtubeEmbedUrl } from "./youtube-video-viewer";

describe("youtubeEmbedUrl", () => {
  it("constructs a paused privacy-enhanced player URL", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1",
    );
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).not.toContain("autoplay");
  });
});
