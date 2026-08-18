import { describe, expect, it } from "vitest";

import { makeMarkdownPreview } from "./markdown-preview";

describe("makeMarkdownPreview", () => {
  it("preserves Markdown block structure and indentation", () => {
    expect(makeMarkdownPreview("# Heading\n\n- First\n  - Nested")).toBe(
      "# Heading\n\n- First\n  - Nested",
    );
  });

  it("normalizes Windows line endings without flattening paragraphs", () => {
    expect(makeMarkdownPreview("First\r\n\r\nSecond")).toBe("First\n\nSecond");
  });

  it("closes a truncated fenced block", () => {
    expect(makeMarkdownPreview("```ts\nconst answer = 42;", 12)).toBe(
      "```ts\nconst \n```\n\n…",
    );
  });
});
