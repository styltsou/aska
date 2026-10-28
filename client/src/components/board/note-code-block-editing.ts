import { Extension } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

const INDENT = "  ";
const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};
const CLOSERS = new Set(Object.values(PAIRS));
const pluginKey = new PluginKey<DecorationSet>("noteCodeBlockEditing");

function codeBlockSelection(state: EditorState) {
  const { $from, $to } = state.selection;
  if ($from.parent.type.name !== "codeBlock" || $from.start() !== $to.start()) {
    return null;
  }
  return { node: $from.parent, start: $from.start() };
}

function lineStarts(text: string, from: number, to: number) {
  const starts = [text.lastIndexOf("\n", Math.max(0, from - 1)) + 1];
  for (let index = starts[0]; index < to; index += 1) {
    if (text[index] === "\n" && index + 1 < to) starts.push(index + 1);
  }
  return starts;
}

function handleIndent(
  state: EditorState,
  dispatch: (tr: Transaction) => void,
  outdent: boolean,
) {
  const block = codeBlockSelection(state);
  if (!block) return false;

  const { from, to } = state.selection;
  const text = block.node.textContent;
  const fromOffset = from - block.start;
  const toOffset = to - block.start;

  if (!outdent && from === to) {
    dispatch(state.tr.insertText(INDENT, from, to));
    return true;
  }

  const starts = lineStarts(text, fromOffset, toOffset);
  const tr = state.tr;
  for (const offset of starts.reverse()) {
    const position = block.start + offset;
    if (outdent) {
      const spaces = /^ {1,2}/.exec(text.slice(offset))?.[0].length ?? 0;
      if (spaces) tr.delete(position, position + spaces);
    } else {
      tr.insertText(INDENT, position);
    }
  }
  if (tr.docChanged) {
    tr.setSelection(
      TextSelection.create(
        tr.doc,
        tr.mapping.map(from, -1),
        tr.mapping.map(to, 1),
      ),
    );
    dispatch(tr);
  }
  return true;
}

function lineNumberDecorations(doc: ProseMirrorNode) {
  const widgets: Decoration[] = [];
  doc.descendants((node, position) => {
    if (node.type.name !== "codeBlock") return true;
    let line = 1;
    const addLine = (at: number) => {
      const number = line++;
      widgets.push(
        Decoration.widget(
          at,
          () => {
            const marker = document.createElement("span");
            marker.className = "note-code-line-number";
            marker.dataset.line = String(number);
            marker.setAttribute("aria-hidden", "true");
            marker.contentEditable = "false";
            return marker;
          },
          { side: -1, key: `${position}:${number}` },
        ),
      );
    };
    addLine(position + 1);
    for (let index = 0; index < node.textContent.length; index += 1) {
      if (node.textContent[index] === "\n") addLine(position + index + 2);
    }
    return false;
  });
  return DecorationSet.create(doc, widgets);
}

export const NoteCodeBlockEditing = Extension.create({
  name: "noteCodeBlockEditing",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Tab: () =>
        handleIndent(
          this.editor.state,
          (tr) => this.editor.view.dispatch(tr),
          false,
        ),
      "Shift-Tab": () =>
        handleIndent(
          this.editor.state,
          (tr) => this.editor.view.dispatch(tr),
          true,
        ),
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: pluginKey,
        state: {
          init: (_, state) => lineNumberDecorations(state.doc),
          apply: (tr, decorations) =>
            tr.docChanged ? lineNumberDecorations(tr.doc) : decorations,
        },
        props: {
          decorations: (state) => pluginKey.getState(state) ?? null,
          handleTextInput: (view, from, to, text) => {
            if (text.length !== 1) return false;
            const { state } = view;
            const $from = state.doc.resolve(from);
            if (
              $from.parent.type.name !== "codeBlock" ||
              $from.start() !== state.doc.resolve(to).start()
            ) {
              return false;
            }
            const source = $from.parent.textContent;
            const offset = from - $from.start();
            const next = source[offset] ?? "";
            if (from === to && CLOSERS.has(text) && next === text) {
              view.dispatch(
                state.tr.setSelection(
                  TextSelection.create(state.doc, from + 1),
                ),
              );
              return true;
            }
            const close = PAIRS[text];
            if (!close) return false;
            const previous = source[offset - 1] ?? "";
            const quote = text === '"' || text === "'" || text === "`";
            if (from === to && next && !/[\s)\]}>,;:]/.test(next)) {
              return false;
            }
            if (
              quote &&
              from === to &&
              (/[\w\\]/.test(previous) || next === text)
            ) {
              return false;
            }
            const selected = state.doc.textBetween(from, to);
            const tr = state.tr.insertText(text + selected + close, from, to);
            tr.setSelection(
              TextSelection.create(
                tr.doc,
                from + 1,
                from + 1 + selected.length,
              ),
            );
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
