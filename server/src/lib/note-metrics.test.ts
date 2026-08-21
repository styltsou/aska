import { describe, expect, it } from "vitest";

import { calculateNoteMetrics } from "./note-metrics";

describe("calculateNoteMetrics", () => {
  it("counts readable markdown text", () => {
    expect(
      calculateNoteMetrics("# Hello\n\n[world](https://example.com)"),
    ).toEqual({
      wordCount: 2,
      readingTimeMinutes: 1,
    });
  });

  it("ignores front matter", () => {
    expect(
      calculateNoteMetrics(
        "---\ntitle: Some title\ntags: [one, two]\n---\n\nThree words here",
      ),
    ).toEqual({
      wordCount: 3,
      readingTimeMinutes: 1,
    });
  });
});
