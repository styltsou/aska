import { describe, expect, it } from "vitest";

import { extractPastedNoteTitle } from "./note-title";

describe("extractPastedNoteTitle", () => {
  it("promotes and removes the first ATX H1", () => {
    expect(extractPastedNoteTitle("# Project plan\n\nBody\n\n# Later")).toEqual(
      { title: "Project plan", content: "Body\n\n# Later" },
    );
  });

  it("recognizes Setext H1s and ignores fenced code", () => {
    expect(
      extractPastedNoteTitle(
        "```md\n# Not a title\n```\n\nHello\n====\n\nBody",
      ),
    ).toEqual({ title: "Hello", content: "```md\n# Not a title\n```\n\nBody" });
  });

  it("leaves Markdown without a H1 unchanged", () => {
    expect(extractPastedNoteTitle("## Heading\n\nBody")).toEqual({
      title: null,
      content: "## Heading\n\nBody",
    });
  });
});
