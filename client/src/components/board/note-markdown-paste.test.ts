import { getSchema, resolveExtensions } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import { describe, expect, it } from "vitest";
import {
  getMarkdownPaste,
  looksLikeMarkdown,
  normalizeMarkdownBlocks,
  PreserveMarkdownImages,
} from "./note-markdown-paste";

describe("Markdown paste", () => {
  it("recognizes common block and inline Markdown without claiming plain prose", () => {
    for (const source of [
      "# Heading",
      "- [ ] Task",
      "1. First",
      "> Quote",
      "```js\nlet x = 1\n```",
      "A **bold** idea",
      "[Link](https://example.com)",
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
    ]) {
      expect(looksLikeMarkdown(source)).toBe(true);
    }
    expect(looksLikeMarkdown("Ordinary text\nwith another line.")).toBe(false);
    expect(looksLikeMarkdown("The result is 2 * 3 = 6.")).toBe(false);
  });

  it("prefers an explicit Markdown clipboard representation", () => {
    const clipboard = {
      getData: (type: string) =>
        type === "text/markdown" ? "# Heading" : "Plain heading",
    };
    expect(getMarkdownPaste(clipboard)).toBe("# Heading");
  });

  it("parses common blocks and retains unsupported image Markdown", () => {
    const extensions = [
      StarterKit,
      TaskList,
      TaskItem,
      TableKit,
      PreserveMarkdownImages,
    ];
    const parser = new MarkdownManager({
      extensions: resolveExtensions(extensions),
    });
    const schema = getSchema(extensions);
    const doc = normalizeMarkdownBlocks(
      parser.parse(
        "# Heading\n\n- [x] Done\n- [ ] Open\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n![Mockup](https://example.com/image.png)",
      ),
      schema,
    );
    expect(doc.content?.map((node) => node.type)).toEqual([
      "heading",
      "taskList",
      "table",
      "paragraph",
    ]);
    expect(JSON.stringify(doc)).toContain(
      "![Mockup](https://example.com/image.png)",
    );
    expect(() => schema.nodeFromJSON(doc).check()).not.toThrow();
    const serialized = parser.serialize(doc);
    const ordinaryParser = new MarkdownManager({
      extensions: resolveExtensions([StarterKit, TaskList, TaskItem, TableKit]),
    });
    expect(JSON.stringify(ordinaryParser.parse(serialized))).toContain(
      "https://example.com/image.png",
    );
  });
});
