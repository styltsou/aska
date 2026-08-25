import { describe, expect, it } from "vitest";

import { calculateNoteMetrics } from "./note-metrics";

describe("calculateNoteMetrics", () => {
  it("counts readable Markdown and strips formatting", () => {
    expect(
      calculateNoteMetrics("# Hello\n\n[world](https://example.com)"),
    ).toEqual({ wordCount: 2, readingTimeMinutes: 1 });
  });

  it("ignores front matter and fenced code", () => {
    expect(
      calculateNoteMetrics(
        "---\ntitle: Hidden\n---\n\nThree words here\n\n```ts\nconst ignored = true\n```",
      ),
    ).toEqual({ wordCount: 3, readingTimeMinutes: 1 });
  });

  it("updates empty notes to zero metrics", () => {
    expect(calculateNoteMetrics("\n\n")).toEqual({
      wordCount: 0,
      readingTimeMinutes: 0,
    });
  });
});
