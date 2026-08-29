import { describe, expect, it } from "vitest";

import { shouldShowNotePreviewRail } from "./note-preview-rail";

describe("shouldShowNotePreviewRail", () => {
  it("requires at least 2 headings", () => {
    expect(shouldShowNotePreviewRail(1, 3_000, 1_000)).toBe(false);
  });

  it("hides the rail when most content is already visible", () => {
    expect(shouldShowNotePreviewRail(2, 1_999, 1_000)).toBe(false);
  });

  it("shows the rail at 2 viewport heights", () => {
    expect(shouldShowNotePreviewRail(2, 2_000, 1_000)).toBe(true);
  });

  it("shows the rail for long notes with only a few headings", () => {
    expect(shouldShowNotePreviewRail(3, 4_000, 1_000)).toBe(true);
  });

  it("waits for a measurable viewport", () => {
    expect(shouldShowNotePreviewRail(3, 4_000, 0)).toBe(false);
  });
});
