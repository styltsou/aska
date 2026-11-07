import { describe, expect, it } from "vitest";

import { composeCopiedNoteMarkdown } from "./note-copy";

describe("composeCopiedNoteMarkdown", () => {
  it("places the current title after front matter and before the edited body", () => {
    expect(
      composeCopiedNoteMarkdown(
        "---\ntitle: Old\n---\nOld body",
        "Edited body",
        "New title",
      ),
    ).toBe("---\ntitle: Old\n---\n# New title\n\nEdited body");
  });

  it("copies a title even when the body is empty", () => {
    expect(composeCopiedNoteMarkdown("", "", "My note")).toBe("# My note");
  });

  it("does not add a heading for a blank title", () => {
    expect(composeCopiedNoteMarkdown("Body", "Body", "  ")).toBe("Body");
  });

  it("preserves canonical front matter while using the edited body", () => {
    const stored = "---\ntitle: Original\ntags: [a, b]\n---\nOld body\n";

    expect(composeCopiedNoteMarkdown(stored, "Edited body\n")).toBe(
      "---\ntitle: Original\ntags: [a, b]\n---\nEdited body\n",
    );
  });

  it("round-trips an unedited full markdown note", () => {
    const stored = "---\ntitle: Original\n---\nBody\n";

    expect(composeCopiedNoteMarkdown(stored, "Body\n")).toBe(stored);
  });

  it("returns the current body unchanged when there is no front matter", () => {
    expect(composeCopiedNoteMarkdown("Old body\n", "Edited body\n")).toBe(
      "Edited body\n",
    );
  });

  it("preserves CRLF front matter exactly", () => {
    expect(
      composeCopiedNoteMarkdown(
        "---\r\ntitle: Original\r\n---\r\nOld body\r\n",
        "Edited body\n",
      ),
    ).toBe("---\r\ntitle: Original\r\n---\r\nEdited body\n");
  });
});
