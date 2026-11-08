import { describe, expect, it } from "vitest";

import { nextRevealLength } from "@/components/board/note-editor/ai/note-ai-reveal";

describe("nextRevealLength", () => {
  it("never cuts a word in half", () => {
    const text = "Scratchpads keep capture fast";
    const end = nextRevealLength(text, 0);
    expect(end).toBeGreaterThan(0);
    expect(end === text.length || text[end] === " ").toBe(true);
  });

  it("reveals the whole text in a bounded number of frames", () => {
    const text = "word ".repeat(800);
    let shown = 0;
    let frames = 0;
    while (shown < text.length) {
      const next = nextRevealLength(text, shown);
      expect(next).toBeGreaterThan(shown);
      shown = next;
      frames++;
    }
    expect(frames).toBeLessThan(240);
  });

  it("is done once everything is shown", () => {
    expect(nextRevealLength("done", 4)).toBe(4);
  });
});
