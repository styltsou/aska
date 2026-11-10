import { describe, expect, it } from "vitest";

import {
  insertCanvasPlainText,
  resolveCanvasTextHandoff,
  type CanvasTextFlowNode,
} from "./canvas-text-node";

function textNode(
  id: string,
  content: string,
  clientId?: string,
): CanvasTextFlowNode {
  return {
    id,
    type: "text",
    position: { x: 0, y: 0 },
    data: {
      object: {
        id,
        clientId,
        type: "text",
        content,
        position: { x: 0, y: 0 },
        font: "inter",
        size: "md",
        color: "ink",
        frontIndex: null,
        createdAt: "2026-10-19T00:00:00.000Z",
        updatedAt: "2026-10-19T00:00:00.000Z",
      },
      editing: true,
      onSelect: () => undefined,
      onPointerDown: () => undefined,
      onBeginEdit: () => undefined,
      onCommit: () => undefined,
    },
  };
}

describe("insertCanvasPlainText", () => {
  it("inserts raw clipboard text at the caret", () => {
    expect(insertCanvasPlainText("Before after", "middle ", 7, 7)).toEqual({
      content: "Before middle after",
      cursor: 14,
    });
  });

  it("replaces the current selection and keeps line breaks", () => {
    expect(insertCanvasPlainText("first\nthird", "second\n", 6, 6)).toEqual({
      content: "first\nsecond\nthird",
      cursor: 13,
    });
    expect(insertCanvasPlainText("draft text", "final", 0, 5)).toEqual({
      content: "final text",
      cursor: 5,
    });
  });
});

describe("resolveCanvasTextHandoff", () => {
  it("shows appended text as soon as the editor closes", () => {
    const node = textNode("text-1", "Before");
    const displayed = resolveCanvasTextHandoff(
      node,
      undefined,
      new Map([["text-1", "Before after"]]),
    );

    expect(displayed.data.editing).toBe(false);
    expect(displayed.data.object.content).toBe("Before after");
    expect(node.data.object.content).toBe("Before");
  });

  it("keeps draft content visible when the server assigns a new id", () => {
    const node = textNode("text-2", "", "text-draft-1");
    const displayed = resolveCanvasTextHandoff(
      node,
      undefined,
      new Map([["text-draft-1", "New text"]]),
    );

    expect(displayed.data.editing).toBe(false);
    expect(displayed.data.object.content).toBe("New text");
  });
});
