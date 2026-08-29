import { describe, expect, it } from "vitest";

import { remarkHighlight } from "./remark-highlight";

describe("remarkHighlight", () => {
  it("turns persisted highlight syntax into semantic mark nodes", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", value: "Keep ==this idea== close." }],
        },
      ],
    };

    remarkHighlight()(tree);

    expect(tree.children[0]?.children).toEqual([
      { type: "text", value: "Keep " },
      {
        type: "emphasis",
        data: {
          hName: "mark",
          hProperties: {
            class: "note-highlight",
            "data-highlight-color": "amber",
          },
        },
        children: [{ type: "text", value: "this idea" }],
      },
      { type: "text", value: " close." },
    ]);
  });

  it("preserves the selected color for the colored note syntax", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: '[highlight color="mint"]A calmer idea[/highlight]',
            },
          ],
        },
      ],
    };

    remarkHighlight()(tree);

    expect(tree.children[0]?.children).toEqual([
      {
        type: "emphasis",
        data: {
          hName: "mark",
          hProperties: {
            class: "note-highlight",
            "data-highlight-color": "mint",
          },
        },
        children: [{ type: "text", value: "A calmer idea" }],
      },
    ]);
  });

  it("does not treat highlight syntax inside code as formatting", () => {
    const tree = {
      type: "root",
      children: [{ type: "inlineCode", value: "==literal==" }],
    };

    remarkHighlight()(tree);

    expect(tree.children).toEqual([
      { type: "inlineCode", value: "==literal==" },
    ]);
  });
});
