import { describe, expect, it } from "vitest";

import { referenceFromRow, type MentionRow } from "./mentioned-assets";

const empty: MentionRow = {
  id: 1,
  type: "note",
  title: null,
  noteMarkdown: null,
  linkUrl: null,
  linkNote: null,
  resourceTitle: null,
  resourceUrl: null,
  hostname: null,
  siteName: null,
  description: null,
  resourceKind: null,
  colorHex: null,
  colorGradient: null,
  colorNote: null,
};

describe("referenceFromRow", () => {
  it("passes a note's Markdown through", () => {
    expect(
      referenceFromRow({ ...empty, title: "", noteMarkdown: "# Plan" }),
    ).toEqual({ kind: "note", title: "Untitled", text: "# Plan" });
  });

  it("summarizes a link from its stored details, skipping empty ones", () => {
    expect(
      referenceFromRow({
        ...empty,
        type: "link",
        linkUrl: "https://example.test/a?ref=x",
        resourceTitle: "Launch plan",
        resourceUrl: "https://example.test/a",
        hostname: "example.test",
        description: "  ",
        resourceKind: "web_page",
      }),
    ).toEqual({
      kind: "link",
      title: "Launch plan",
      text: [
        "Title: Launch plan",
        "URL: https://example.test/a",
        "Site: example.test",
        "Kind: web_page",
      ].join("\n"),
    });
  });

  it("describes a solid color and a gradient", () => {
    expect(
      referenceFromRow({
        ...empty,
        type: "color",
        title: "Deep teal",
        colorHex: "#0f766e",
        colorNote: "Accent",
      })?.text,
    ).toBe("Name: Deep teal\nValue: #0f766e\nUser's note: Accent");
    expect(
      referenceFromRow({
        ...empty,
        type: "color",
        colorGradient: { from: "#000000", to: "#ffffff", angle: 90 },
      }),
    ).toEqual({
      kind: "color",
      title: "Color",
      text: "Name: Color\nGradient: linear at 90°, #000000 to #ffffff",
    });
  });

  it("skips rows without their type's data", () => {
    expect(referenceFromRow({ ...empty, type: "link" })).toBeNull();
    expect(referenceFromRow({ ...empty, type: "image" })).toBeNull();
  });
});
