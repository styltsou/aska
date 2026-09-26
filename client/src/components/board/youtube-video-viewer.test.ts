import { describe, expect, it } from "vitest";

import {
  formatVideoEditedLabel,
  youtubeEmbedUrl,
} from "./youtube-video-viewer";
import { hasAssetBeenEdited } from "./asset-timestamp-card";

describe("youtubeEmbedUrl", () => {
  it("constructs a paused privacy-enhanced player URL", () => {
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1",
    );
    expect(youtubeEmbedUrl("dQw4w9WgXcQ")).not.toContain("autoplay");
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
