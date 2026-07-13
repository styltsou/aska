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
});
