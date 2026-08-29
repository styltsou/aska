import { describe, expect, it } from "vitest";

import { extractNoteMentions, rewriteNoteMentionLabels } from "./note-mentions";

describe("note mention markdown", () => {
  it("extracts note and color links while ignoring ordinary links", () => {
    expect(
      extractNoteMentions(
        "See [Plan](note:12), [Blue](color:8), and [site](https://example.com).",
      ).map(({ targetAssetId, targetType, fallbackLabel }) => ({
        targetAssetId,
        targetType,
        fallbackLabel,
      })),
    ).toEqual([
      { targetAssetId: 12, targetType: "note", fallbackLabel: "Plan" },
      { targetAssetId: 8, targetType: "color", fallbackLabel: "Blue" },
    ]);
  });

  it("does not treat examples inside inline or fenced code as references", () => {
    const markdown = [
      "`[Inline](note:1)`",
      "",
      "```md",
      "[Fenced](color:2)",
      "```",
      "",
      "[Real](note:3)",
    ].join("\n");

    expect(extractNoteMentions(markdown)).toEqual([
      expect.objectContaining({ targetAssetId: 3, targetType: "note" }),
    ]);
  });

  it("rewrites every matching fallback without reformatting the note", () => {
    const markdown =
      "[Old](note:4) and [Old again](note:4) plus `[Old](note:4)`.";
    expect(
      rewriteNoteMentionLabels(
        markdown,
        new Map([["note:4", "New \\ title]"]]),
      ),
    ).toBe(
      "[New _ title_](note:4) and [New _ title_](note:4) plus `[Old](note:4)`.",
    );
  });
});
