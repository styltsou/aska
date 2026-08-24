import { describe, expect, it } from "vitest";

import {
  getSaveableNoteContent,
  isNoteContentTooLong,
  MAX_NOTE_CONTENT_LENGTH,
} from "@/lib/note-content";

describe("getSaveableNoteContent", () => {
  it("preserves the blank paragraph at the end of a note", () => {
    expect(getSaveableNoteContent("A line\n\n")).toBe("A line\n\n");
  });

  it("rejects content that is only whitespace", () => {
    expect(getSaveableNoteContent(" \n\n")).toBeUndefined();
  });

  it("rejects front matter without a note body", () => {
    expect(getSaveableNoteContent("---\ntags: [idea]\n---\n")).toBeUndefined();
  });
});

describe("note content limits", () => {
  it("accepts content at the limit and rejects content above it", () => {
    expect(isNoteContentTooLong("x".repeat(MAX_NOTE_CONTENT_LENGTH))).toBe(
      false,
    );
    expect(isNoteContentTooLong("x".repeat(MAX_NOTE_CONTENT_LENGTH + 1))).toBe(
      true,
    );
  });
});
