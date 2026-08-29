import { resolveExtensions } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TableKit } from "@tiptap/extension-table";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { NoteHighlight } from "@/components/board/note-rich-text";
import { describe, expect, it } from "vitest";

const markdown = new MarkdownManager({
  extensions: resolveExtensions([
    StarterKit,
    TaskList,
    TaskItem,
    Highlight,
    TableKit,
  ]),
});

const noteMarkdown = new MarkdownManager({
  extensions: resolveExtensions([
    StarterKit,
    TaskList,
    TaskItem,
    NoteHighlight,
    TableKit,
  ]),
});

describe("note Markdown round trips", () => {
  it("preserves every supported block and inline mark", () => {
    const source = [
      "# Working note",
      "",
      "## Direction",
      "",
      "A **bold**, *italic*, `coded`, [linked](https://example.com), and ==highlighted== idea.",
      "",
      "- Bullet",
      "- List",
      "",
      "1. First",
      "2. Second",
      "",
      "- [ ] Open task",
      "- [x] Finished task",
      "",
      "> A useful quotation",
      "",
      "---",
      "",
      "```ts",
      "const answer = 42",
      "```",
    ].join("\n");

    expect(markdown.serialize(markdown.parse(source))).toBe(source);
  });

  it("preserves GFM tables with a header row", () => {
    const source = [
      "| Feature | Status |",
      "| --- | --- |",
      "| Tables | works |",
    ].join("\n");

    const serialized = markdown.serialize(markdown.parse(source));
    expect(serialized.trim()).toBe(
      [
        "| Feature | Status |",
        "| ------- | ------ |",
        "| Tables  | works  |",
      ].join("\n"),
    );
    expect(markdown.serialize(markdown.parse(serialized))).toBe(serialized);
  });

  it("persists non-default highlight colors and reads legacy highlights", () => {
    const source =
      'A ==legacy== idea and [highlight color="mint"]a calmer idea[/highlight].';

    const serialized = noteMarkdown.serialize(noteMarkdown.parse(source));

    expect(serialized).toBe(source);
    expect(noteMarkdown.serialize(noteMarkdown.parse(serialized))).toBe(
      serialized,
    );
  });
});
