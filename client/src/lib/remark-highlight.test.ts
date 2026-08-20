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
        data: { hName: "mark" },
        children: [{ type: "text", value: "this idea" }],
      },
      { type: "text", value: " close." },
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
