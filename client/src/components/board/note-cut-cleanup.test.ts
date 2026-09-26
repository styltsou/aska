import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { cutListItemCleanupPlugin } from "./note-cut-cleanup";

const schema = getSchema([
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    underline: false,
    codeBlock: false,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
]);

const text = (value: string) => ({ type: "text", text: value });
const paragraph = (value?: string) =>
  value ? { type: "paragraph", content: [text(value)] } : { type: "paragraph" };
const item = (type: string, value?: string) => ({
  type,
  ...(type === "taskItem" ? { attrs: { checked: false } } : {}),
  content: [paragraph(value)],
});
const list = (type: string, items: object[]) => ({ type, content: items });

function createState(content: object[]) {
  return EditorState.create({
    schema,
    doc: schema.nodeFromJSON({ type: "doc", content }),
    plugins: [cutListItemCleanupPlugin()],
  });
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

function cut(
  state: EditorState,
  needle: string,
  uiEvent: string | null = "cut",
) {
  const { from, to } = findText(state.doc, needle);
  return cutRange(state, from, to, uiEvent);
}

function cutRange(
  state: EditorState,
  from: number,
  to: number,
  uiEvent: string | null,
) {
  const tr = state.tr
    .setSelection(TextSelection.create(state.doc, from, to))
    .deleteSelection();
  if (uiEvent) tr.setMeta("uiEvent", uiEvent);
  return state.applyTransaction(tr);
}

function docJSON(result: { state: EditorState }) {
  return result.state.doc.toJSON();
}

function appendedCount(result: { transactions: readonly unknown[] }) {
  return result.transactions.length - 1;
}

describe("cut list item cleanup", () => {
  it("lifts a task item that the cut emptied out of its list", () => {
    const state = createState([
      list("taskList", [
        item("taskItem", "first task"),
        item("taskItem", "second task"),
      ]),
      paragraph("tail"),
    ]);
    const result = cut(state, "first task");

    expect(appendedCount(result)).toBe(1);
    expect(docJSON(result)).toEqual({
      type: "doc",
      content: [
        paragraph(""),
        list("taskList", [item("taskItem", "second task")]),
        paragraph("tail"),
      ],
    });
    expect(result.state.selection.$from.parent.type.name).toBe("paragraph");
  });

  it("lifts an emptied item out of a single-item list and drops the list", () => {
    const state = createState([
      list("taskList", [item("taskItem", "only task")]),
      paragraph("tail"),
    ]);
    const result = cut(state, "only task");

    expect(docJSON(result)).toEqual({
      type: "doc",
      content: [paragraph(""), paragraph("tail")],
    });
  });

  it("lifts an emptied bullet list item", () => {
    const state = createState([
      list("bulletList", [
        item("listItem", "bullet one"),
        item("listItem", "bullet two"),
      ]),
      paragraph("tail"),
    ]);
    const result = cut(state, "bullet one");

    expect(docJSON(result)).toEqual({
      type: "doc",
      content: [
        paragraph(""),
        list("bulletList", [item("listItem", "bullet two")]),
        paragraph("tail"),
      ],
    });
  });

  it("lifts an emptied task item out of its parent item", () => {
    const state = createState([
      list("taskList", [
        item("taskItem", "parent task"),
        item("taskItem", "child task"),
      ]),
    ]);
    const result = cut(state, "child task");

    expect(docJSON(result)).toEqual({
      type: "doc",
      content: [
        list("taskList", [item("taskItem", "parent task")]),
        paragraph(""),
      ],
    });
  });

  it("leaves items that still have text alone", () => {
    const state = createState([
      list("taskList", [
        item("taskItem", "first task"),
        item("taskItem", "second"),
      ]),
    ]);
    const { from } = findText(state.doc, "first task");
    const result = cutRange(state, from, from + "first ".length, "cut");

    expect(appendedCount(result)).toBe(0);
    expect(docJSON(result)).toEqual({
      type: "doc",
      content: [
        list("taskList", [
          item("taskItem", "task"),
          item("taskItem", "second"),
        ]),
      ],
    });
  });

  it("only reacts to cut", () => {
    const state = createState([
      list("taskList", [
        item("taskItem", "first task"),
        item("taskItem", "second"),
      ]),
    ]);
    expect(appendedCount(cut(state, "first task", "delete"))).toBe(0);
    expect(appendedCount(cut(state, "first task", null))).toBe(0);
    expect(docJSON(cut(state, "first task", "delete"))).toEqual({
      type: "doc",
      content: [
        list("taskList", [item("taskItem"), item("taskItem", "second")]),
      ],
    });
  });

  it("does not touch empty items created elsewhere in the document", () => {
    const state = createState([
      list("taskList", [item("taskItem"), item("taskItem", "second")]),
      paragraph("tail"),
    ]);
    const result = cut(state, "tail");

    expect(appendedCount(result)).toBe(0);
    expect(docJSON(result)).toEqual({
      type: "doc",
      content: [
        list("taskList", [item("taskItem"), item("taskItem", "second")]),
        paragraph(""),
      ],
    });
  });

  it("does not lift when the cut leaves the caret outside a list", () => {
    const state = createState([
      paragraph("head"),
      list("bulletList", [item("listItem", "bullet one")]),
    ]);
    const result = cutRange(
      state,
      1,
      1 + "head".length + "bullet one".length + 6,
      "cut",
    );

    expect(appendedCount(result)).toBe(0);
  });
});
