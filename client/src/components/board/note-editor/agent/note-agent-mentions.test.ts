import { describe, expect, it } from "vitest";

import type { NoteMentionTarget } from "@/api/note-mentions";

import { mentionQueryBefore, mentionsForRequest } from "./note-agent-mentions";

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

describe("mentionsForRequest", () => {
  it("sends each mention's ID and type only", () => {
    const target = (assetId: number, assetType: "note" | "link" | "color") =>
      ({
        assetId,
        assetType,
        label: "x",
        title: "x",
        hex: null,
        gradient: null,
        snippet: null,
        locationLabel: "Inbox",
        collectionSlug: null,
        folderPath: null,
      }) satisfies NoteMentionTarget;

    expect(
      mentionsForRequest([
        target(1, "note"),
        target(2, "link"),
        target(3, "color"),
      ]),
    ).toEqual([
      { assetId: 1, type: "note" },
      { assetId: 2, type: "link" },
      { assetId: 3, type: "color" },
    ]);
  });
});
