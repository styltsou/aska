import { describe, expect, it } from "vitest";

import {
  getVisibleNoteSectionIds,
  isNotePreviewRailSectionHighlighted,
  shouldShowNotePreviewRail,
} from "./note-preview-rail";

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

describe("getVisibleNoteSectionIds", () => {
  const sections = [
    { id: "introduction", top: 100 },
    { id: "planning", top: 400 },
    { id: "delivery", top: 800 },
  ];

  it("marks every section occupying the viewport as visible", () => {
    expect(getVisibleNoteSectionIds(sections, 250, 900)).toEqual([
      "introduction",
      "planning",
      "delivery",
    ]);
  });

  it("excludes sections that end before the viewport", () => {
    expect(getVisibleNoteSectionIds(sections, 450, 700)).toEqual(["planning"]);
  });
});

describe("isNotePreviewRailSectionHighlighted", () => {
  it("colors every visible section while the rail is idle", () => {
    expect(isNotePreviewRailSectionHighlighted(0, null, true)).toBe(true);
    expect(isNotePreviewRailSectionHighlighted(1, null, false)).toBe(false);
  });

  it("colors only the hovered section during hover", () => {
    expect(isNotePreviewRailSectionHighlighted(0, 1, true)).toBe(false);
    expect(isNotePreviewRailSectionHighlighted(1, 1, false)).toBe(true);
  });
});
