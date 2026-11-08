import { describe, expect, it } from "vitest";

import { nextRevealLength } from "@/components/board/note-editor/ai/note-ai-reveal";

function revealDuration(text: string, frameMs: number) {
  let shown = 0;
  let elapsed = 0;
  while (shown < text.length) {
    const next = nextRevealLength(text, shown, frameMs);
    expect(next).toBeGreaterThan(shown);
    shown = next;
    elapsed += frameMs;
  }
  return elapsed;
}

describe("nextRevealLength", () => {
  it("never cuts a word in half", () => {
    const text = "Scratchpads keep capture fast";
    const end = nextRevealLength(text, 0, 16);
    expect(end).toBeGreaterThan(0);
    expect(end === text.length || text[end] === " ").toBe(true);
  });

  it("catches up with a large chunk in a few seconds at most", () => {
    expect(revealDuration("word ".repeat(400), 16)).toBeLessThan(3000);
  });

  it("doesn't stretch out when frames are throttled", () => {
    const text = "word ".repeat(200);
    expect(revealDuration(text, 1000)).toBeLessThanOrEqual(
      revealDuration(text, 16) + 1000,
    );
  });

  it("is done once everything is shown", () => {
    expect(nextRevealLength("done", 4, 16)).toBe(4);
  });
});
