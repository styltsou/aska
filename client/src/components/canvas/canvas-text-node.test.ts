import { describe, expect, it } from "vitest";

import { insertCanvasPlainText } from "./canvas-text-node";

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
