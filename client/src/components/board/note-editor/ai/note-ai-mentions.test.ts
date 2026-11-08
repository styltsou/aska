import { describe, expect, it } from "vitest";

import { mentionQueryBefore } from "./note-ai-mentions";

describe("mentionQueryBefore", () => {
  it("finds the @query being typed before the caret", () => {
    const text = "summarize @road";
    expect(mentionQueryBefore(text, text.length)).toEqual({
      text: "road",
      start: 10,
      end: 15,
    });
  });

  it("opens on a bare @ at the start or after a space", () => {
    expect(mentionQueryBefore("@", 1)?.text).toBe("");
    expect(mentionQueryBefore("use @", 5)?.text).toBe("");
  });

  it("ignores emails and finished mentions", () => {
    expect(mentionQueryBefore("mail me@home", 12)).toBeNull();
    expect(mentionQueryBefore("@road map", 9)).toBeNull();
  });
});
