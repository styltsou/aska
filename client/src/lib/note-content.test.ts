import { describe, expect, it } from "vitest";

import { getSaveableNoteContent } from "@/lib/note-content";

describe("getSaveableNoteContent", () => {
  it("preserves the blank paragraph at the end of a note", () => {
    expect(getSaveableNoteContent("A line\n\n")).toBe("A line\n\n");
  });

  it("rejects content that is only whitespace", () => {
    expect(getSaveableNoteContent(" \n\n")).toBeUndefined();
  });
});
