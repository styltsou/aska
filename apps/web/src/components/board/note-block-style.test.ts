import { Node as TiptapNode, getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { blockStyleLabel, resolveBlockStyle } from "./note-block-style";

const CheckList = TiptapNode.create({
  name: "checkList",
  group: "block list",
  content: "checkItem+",
});

const CheckItem = TiptapNode.create({
  name: "checkItem",
  content: "paragraph block*",
  defining: true,
});

const NumberedList = TiptapNode.create({
  name: "numberedList",
  group: "block list",
  content: "numberedItem+",
});

const NumberedItem = TiptapNode.create({
  name: "numberedItem",
  content: "paragraph block*",
  defining: true,
});

const schema = getSchema([
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    underline: false,
    codeBlock: false,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  CheckList,
  CheckItem,
  NumberedList,
  NumberedItem,
]);

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value?: string) => ({
  type: "paragraph",
  content: value ? [text(value)] : undefined,
});
const item = (type: string, value?: string) => ({
  type,
  content: [paragraph(value)],
});
const list = (type: string, items: object[]) => ({ type, content: items });
const heading = (level: number, value: string) => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
});

function docFrom(content: object[]) {
  return schema.nodeFromJSON({ type: "doc", content });
}

function findText(doc: ProseMirrorNode, needle: string) {
  const found = { from: -1, to: -1 };
  doc.descendants((node, pos) => {
    if (found.from !== -1 || !node.isText || !node.text) return;
    const offset = node.text.indexOf(needle);
    if (offset === -1) return;
    found.from = pos + offset;
    found.to = pos + offset + needle.length;
  });
  if (found.from === -1) throw new Error(`text not found: ${needle}`);
  return found;
}

function styleFor(content: object[], needle: string, headNeedle?: string) {
  const doc = docFrom(content);
  const { from, to } = findText(doc, needle);
  const head = headNeedle ? findText(doc, headNeedle).from : to;
  return resolveBlockStyle(TextSelection.create(doc, from, head));
}

function caretStyleFor(content: object[], needle: string) {
  const doc = docFrom(content);
  const { from } = findText(doc, needle);
  return resolveBlockStyle(TextSelection.create(doc, from, from));
}

describe("resolveBlockStyle", () => {
  it("falls back to Text for plain paragraphs and unlabelled blocks", () => {
    expect(caretStyleFor([paragraph("plain")], "plain")).toBe("paragraph");
    expect(
      caretStyleFor(
        [{ type: "blockquote", content: [paragraph("quote")] }],
        "quote",
      ),
    ).toBe("paragraph");
    expect(blockStyleLabel("paragraph")).toBe("Text");
  });

  it("resolves every configured heading level", () => {
    expect(caretStyleFor([heading(1, "one")], "one")).toBe("heading-1");
    expect(caretStyleFor([heading(2, "two")], "two")).toBe("heading-2");
    expect(caretStyleFor([heading(3, "three")], "three")).toBe("heading-3");
    expect(caretStyleFor([heading(4, "four")], "four")).toBe("heading-4");
    expect(blockStyleLabel("heading-2")).toBe("Heading 2");
  });

  it("resolves list styles from the enclosing list container", () => {
    expect(
      caretStyleFor(
        [list("bulletList", [item("listItem", "bullet one")])],
        "bullet one",
      ),
    ).toBe("bullet-list");
    expect(
      caretStyleFor(
        [list("orderedList", [item("listItem", "first")])],
        "first",
      ),
    ).toBe("ordered-list");
    expect(
      caretStyleFor(
        [list("taskList", [item("taskItem", "convert me")])],
        "convert me",
      ),
    ).toBe("task-list");
  });

  it("keeps the list style when the selection bleeds into the next block", () => {
    const content = [
      list("taskList", [item("taskItem", "convert me")]),
      paragraph("tail"),
    ];
    // Start inside the task item, end inside the following paragraph. This
    // selection spans two blocks, which made every isActive() flag report
    // false and the dropdown fall back to "Text".
    expect(styleFor(content, "convert me", "tail")).toBe("task-list");
    expect(
      styleFor(
        [
          list("bulletList", [item("listItem", "bullet one")]),
          paragraph("tail"),
        ],
        "bullet one",
        "tail",
      ),
    ).toBe("bullet-list");
  });

  it("keeps the list style for multi-block selections inside a list", () => {
    const content = [
      list("taskList", [
        item("taskItem", "first task"),
        item("taskItem", "second task"),
      ]),
    ];
    expect(styleFor(content, "first", "second")).toBe("task-list");
  });

  it("prefers the innermost list for nested lists", () => {
    const content = [
      list("taskList", [
        {
          type: "taskItem",
          content: [
            paragraph("parent task"),
            list("bulletList", [item("listItem", "child bullet")]),
          ],
        },
      ]),
    ];
    expect(caretStyleFor(content, "parent task")).toBe("task-list");
    expect(caretStyleFor(content, "child bullet")).toBe("bullet-list");
  });

  it("derives styles for list extensions it does not know by name", () => {
    expect(
      caretStyleFor(
        [list("checkList", [item("checkItem", "ship it")])],
        "ship it",
      ),
    ).toBe("task-list");
    expect(
      caretStyleFor(
        [list("numberedList", [item("numberedItem", "one")])],
        "one",
      ),
    ).toBe("ordered-list");
  });

  it("resolves headings nested inside another block", () => {
    expect(
      caretStyleFor(
        [{ type: "blockquote", content: [heading(2, "quoted")] }],
        "quoted",
      ),
    ).toBe("heading-2");
  });
});

describe("resolveBlockStyle with editor state", () => {
  it("reads the style from the current state selection", () => {
    const state = EditorState.create({
      schema,
      doc: docFrom([
        list("taskList", [item("taskItem", "convert me")]),
        paragraph("tail"),
      ]),
    });
    const { from, to } = findText(state.doc, "convert me");
    const next = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, from, to)),
    );
    expect(resolveBlockStyle(next.selection)).toBe("task-list");
  });
});
