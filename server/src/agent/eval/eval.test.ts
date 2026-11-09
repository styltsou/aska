import { describe, expect, it } from "vitest";

import { CURSOR, EVAL_CASES } from "@/agent/eval/cases";
import { scoreOutput } from "@/agent/eval/score";

const byId = (id: string) => EVAL_CASES.find((testCase) => testCase.id === id)!;

describe("eval cases", () => {
  it("each scripted answer passes its own content checks", () => {
    for (const testCase of EVAL_CASES) {
      const failures = scoreOutput(testCase, testCase.fakeOutput, 1).filter(
        (failure) => !failure.startsWith("unneeded lookups"),
      );
      expect(failures, testCase.id).toEqual([]);
    }
  });

  it("keeps the far-away facts outside what the baseline sends", () => {
    const longNote = byId("far-in-note").note;
    // The baseline keeps 38,000 characters around a cursor at the very end.
    expect(
      longNote.indexOf(CURSOR) - longNote.indexOf("March 3"),
    ).toBeGreaterThan(38_000);
    const reference = byId("deep-in-reference").references![0]!.markdown;
    // Mentioned notes are cut at 12,000 characters.
    expect(reference.indexOf("teal")).toBeGreaterThan(12_000);
  });
});

describe("scoreOutput", () => {
  it("flags missing text, leaked markers, length and routing", () => {
    const rewrite = byId("rewrite-inline");
    expect(scoreOutput(rewrite, "⟦selection⟧ " + "x".repeat(200), 1)).toEqual([
      'contains "⟦"',
      expect.stringMatching(/^length .* > 3x$/),
      "unneeded lookups (1)",
    ]);
    expect(scoreOutput(byId("far-in-note"), "Sometime in spring.", 0)).toEqual([
      'missing "March 3"',
      "no lookup",
    ]);
  });
});
