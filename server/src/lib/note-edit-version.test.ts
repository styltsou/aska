import { describe, expect, it } from "vitest";

import { assertNoteEditVersion } from "@/lib/note-edit-version";

describe("note edit version check", () => {
  const current = { content: "Latest body", title: "Latest title" };

  it("accepts an edit based on the current note", () => {
    expect(() =>
      assertNoteEditVersion(
        {
          content: "New body",
          expectedContent: current.content,
          expectedTitle: current.title,
        },
        current,
      ),
    ).not.toThrow();
  });

  it("rejects stale body and title versions", () => {
    expect(() =>
      assertNoteEditVersion(
        {
          content: "New body",
          expectedContent: "Old body",
          expectedTitle: current.title,
        },
        current,
      ),
    ).toThrow("This note changed elsewhere");
    expect(() =>
      assertNoteEditVersion(
        {
          title: "New title",
          expectedContent: current.content,
          expectedTitle: "Old title",
        },
        current,
      ),
    ).toThrow("This note changed elsewhere");
  });

  it("requires an original version for note edits", () => {
    expect(() =>
      assertNoteEditVersion({ content: "New body" }, current),
    ).toThrow("missing its original version");
  });
});
