import { Extension, type Editor } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Fragment } from "@tiptap/pm/model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Tracks one in-editor AI session: a range of top-level blocks the AI owns
 * while it writes, plus the inline prompt widget rendered after that range.
 *
 * Every change made during a session skips history. Accepting replays the
 * final content as one history step, so a single undo removes the AI output
 * and discarding leaves no trace in the undo stack.
 */

export type NoteAiRange = { from: number; to: number };

type NoteAiSessionState = {
  range: NoteAiRange | null;
  streaming: boolean;
  widget: HTMLElement | null;
  /** The session opened on the note's last line. */
  endsDoc: boolean;
};

type NoteAiSessionMeta =
  | { type: "start"; range: NoteAiRange; widget: HTMLElement }
  | { type: "range"; range: NoteAiRange }
  | { type: "streaming"; streaming: boolean }
  | { type: "end" };

const EMPTY_STATE: NoteAiSessionState = {
  range: null,
  streaming: false,
  widget: null,
  endsDoc: false,
};

export const noteAiSessionKey = new PluginKey<NoteAiSessionState>(
  "noteAiSession",
);

export const NOTE_AI_CURSOR_MARKER = "⟦cursor⟧";

export function getNoteAiSession(state: EditorState) {
  return noteAiSessionKey.getState(state) ?? EMPTY_STATE;
}

export function isNoteAiSessionActive(state: EditorState) {
  return getNoteAiSession(state).range !== null;
}

function selectionTouchesSession(state: EditorState) {
  const { range } = getNoteAiSession(state);
  if (!range) return false;
  // Until the AI writes anything, the prompt is about to take focus (its
  // empty line is hidden, so the caret may sit elsewhere); hold all typing.
  const node = state.doc.nodeAt(range.from);
  if (range.to - range.from === 2 && node?.content.size === 0) return true;
  const { from, to } = state.selection;
  return to >= range.from && from <= range.to;
}

function withMeta(tr: Transaction, meta: NoteAiSessionMeta) {
  return tr.setMeta(noteAiSessionKey, meta);
}

export const NoteAiSession = Extension.create({
  name: "noteAiSession",
  addProseMirrorPlugins() {
    return [createNoteAiSessionPlugin()];
  },
});

export function createNoteAiSessionPlugin() {
  return new Plugin<NoteAiSessionState>({
    key: noteAiSessionKey,
    state: {
      init: () => EMPTY_STATE,
      apply(tr, value) {
        const meta = tr.getMeta(noteAiSessionKey) as
          | NoteAiSessionMeta
          | undefined;
        if (meta?.type === "start") {
          return {
            range: meta.range,
            streaming: false,
            widget: meta.widget,
            endsDoc: meta.range.to === tr.doc.content.size,
          };
        }
        if (meta?.type === "end") return EMPTY_STATE;
        if (!value.range) return value;
        if (meta?.type === "range") return { ...value, range: meta.range };
        if (meta?.type === "streaming") {
          return { ...value, streaming: meta.streaming };
        }
        if (!tr.docChanged) return value;

        // Content inserted at either boundary belongs outside the range.
        const from = tr.mapping.map(value.range.from, 1);
        const to = tr.mapping.map(value.range.to, -1);
        if (from >= to) return EMPTY_STATE;
        return { ...value, range: { from, to } };
      },
    },
    props: {
      // The AI owns its range: typing there (for example in the moment
      // before the prompt takes focus, or while output streams) would be
      // overwritten by the next update, so swallow it instead.
      handleTextInput: (view) => selectionTouchesSession(view.state),
      handlePaste: (view) => selectionTouchesSession(view.state),
      handleDrop: (view) => selectionTouchesSession(view.state),
      handleKeyDown(view, event) {
        if (!selectionTouchesSession(view.state)) return false;
        if (event.ctrlKey || event.metaKey || event.altKey) {
          return ["Backspace", "Delete"].includes(event.key);
        }
        return (
          event.key.length === 1 ||
          ["Enter", "Backspace", "Delete", "Tab"].includes(event.key)
        );
      },
      decorations(state) {
        const { range, streaming, widget } = getNoteAiSession(state);
        if (!range || !widget) return null;

        const decorations: Decoration[] = [];
        state.doc.forEach((node, offset) => {
          const end = offset + node.nodeSize;
          if (offset < range.from || end > range.to) return;
          decorations.push(
            Decoration.node(offset, end, {
              class: streaming
                ? "note-ai-pending note-ai-streaming"
                : "note-ai-pending",
            }),
          );
        });
        decorations.push(
          Decoration.widget(range.to, widget, {
            key: "note-ai-prompt",
            side: -1,
            ignoreSelection: true,
            stopEvent: () => true,
          }),
        );
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

/** Opens a session on the empty top-level paragraph holding the cursor. */
export function startNoteAiSession(editor: Editor, widget: HTMLElement) {
  const { $from } = editor.state.selection;
  if ($from.depth !== 1) return false;
  const range = { from: $from.before(1), to: $from.after(1) };
  editor.view.dispatch(
    withMeta(editor.state.tr, { type: "start", range, widget }).setMeta(
      "addToHistory",
      false,
    ),
  );
  return true;
}

function markdownToFragment(editor: Editor, markdown: string) {
  const { schema } = editor;
  const empty = Fragment.from(schema.nodes.paragraph.create());
  if (!markdown.trim() || !editor.markdown) return empty;
  try {
    const content = schema.nodeFromJSON(
      editor.markdown.parse(markdown),
    ).content;
    return content.size > 0 ? content : empty;
  } catch {
    // Partial Markdown can momentarily produce invalid structure; the next
    // delta will usually parse again.
    return null;
  }
}

/** Replaces the session's content with `markdown` without touching history. */
export function setNoteAiContent(editor: Editor, markdown: string) {
  const { range } = getNoteAiSession(editor.state);
  if (!range) return false;
  const fragment = markdownToFragment(editor, markdown);
  if (!fragment) return false;
  const tr = editor.state.tr
    .replaceWith(range.from, range.to, fragment)
    .setMeta("addToHistory", false);
  withMeta(tr, {
    type: "range",
    range: { from: range.from, to: range.from + fragment.size },
  });
  editor.view.dispatch(tr);
  return true;
}

export function setNoteAiStreaming(editor: Editor, streaming: boolean) {
  if (!isNoteAiSessionActive(editor.state)) return;
  editor.view.dispatch(
    withMeta(editor.state.tr, { type: "streaming", streaming }).setMeta(
      "addToHistory",
      false,
    ),
  );
}

function restoreEmptyParagraph(editor: Editor, range: NoteAiRange) {
  return editor.state.tr
    .replaceWith(range.from, range.to, editor.schema.nodes.paragraph.create())
    .setMeta("addToHistory", false);
}

type EndOptions = {
  /** Move the cursor to the result; off when the user already clicked away. */
  select?: boolean;
};

/** Keeps the AI content and records it as one undoable step. */
export function acceptNoteAiSession(
  editor: Editor,
  { select = true }: EndOptions = {},
) {
  const { range } = getNoteAiSession(editor.state);
  if (!range) return;
  const content = editor.state.doc.slice(range.from, range.to).content;
  const isEmpty =
    content.childCount === 1 &&
    content.firstChild?.type.name === "paragraph" &&
    content.firstChild.content.size === 0;
  if (isEmpty) {
    discardNoteAiSession(editor, { select });
    return;
  }

  // Swap back to the original empty line outside history, then re-insert the
  // final content in a single history step.
  editor.view.dispatch(restoreEmptyParagraph(editor, range));
  // Never merge with whatever the user edited just before opening the prompt.
  const tr = closeHistory(editor.state.tr).replaceWith(
    range.from,
    range.from + 2,
    content,
  );
  if (select) {
    const end = range.from + content.size;
    tr.setSelection(TextSelection.near(tr.doc.resolve(end), -1));
    tr.scrollIntoView();
  }
  editor.view.dispatch(withMeta(tr, { type: "end" }));
}

/** Removes the AI content and returns the cursor to the original empty line. */
export function discardNoteAiSession(
  editor: Editor,
  { select = true }: EndOptions = {},
) {
  const { range, endsDoc } = getNoteAiSession(editor.state);
  if (!range) return;
  const tr = restoreEmptyParagraph(editor, range);
  // A trailing-node plugin may have appended an empty line after AI output
  // that ended in a list or similar; it goes away with the output.
  const restoredEnd = range.from + 2;
  if (endsDoc && restoredEnd < tr.doc.content.size) {
    const rest = tr.doc.slice(restoredEnd, tr.doc.content.size).content;
    let allEmpty = true;
    rest.forEach((node) => {
      if (node.type.name !== "paragraph" || node.content.size > 0) {
        allEmpty = false;
      }
    });
    if (allEmpty) tr.delete(restoredEnd, tr.doc.content.size);
  }
  if (select) tr.setSelection(TextSelection.create(tr.doc, range.from + 1));
  editor.view.dispatch(withMeta(tr, { type: "end" }));
}

/**
 * Serializes the note with a cursor marker where the session sits, excluding
 * any draft AI content, so the model knows where its output will land.
 */
export function noteMarkdownAtAiCursor(editor: Editor) {
  const { range } = getNoteAiSession(editor.state);
  if (!range || !editor.markdown) return editor.getMarkdown();
  const tr = editor.state.tr.replaceWith(
    range.from,
    range.to,
    editor.schema.nodes.paragraph.create(
      null,
      editor.schema.text(NOTE_AI_CURSOR_MARKER),
    ),
  );
  return editor.markdown.serialize(tr.doc.toJSON());
}

/**
 * The note as it would be saved: a pending draft is not part of the note
 * until it is kept, so it is swapped back for the empty line it opened on.
 */
export function noteMarkdownWithoutAiDraft(editor: Editor) {
  const { range } = getNoteAiSession(editor.state);
  if (!range || !editor.markdown) return editor.getMarkdown();
  const tr = editor.state.tr.replaceWith(
    range.from,
    range.to,
    editor.schema.nodes.paragraph.create(),
  );
  return editor.markdown.serialize(tr.doc.toJSON());
}

/** Index of the top-level block the session opened on. */
export function noteAiSessionBlockIndex(state: EditorState) {
  const { range } = getNoteAiSession(state);
  if (!range) return null;
  return state.doc.resolve(range.from).index(0);
}

/**
 * Reopens a session on the top-level block at `index`, which must be an empty
 * paragraph (the line a stored draft was written on).
 */
export function startNoteAiSessionAtBlock(
  editor: Editor,
  index: number,
  widget: HTMLElement,
) {
  const { doc } = editor.state;
  if (index < 0 || index >= doc.childCount) return false;
  const node = doc.child(index);
  if (node.type.name !== "paragraph" || node.content.size > 0) return false;
  let from = 0;
  for (let i = 0; i < index; i += 1) from += doc.child(i).nodeSize;
  const range = { from, to: from + node.nodeSize };
  editor.view.dispatch(
    withMeta(editor.state.tr, { type: "start", range, widget }).setMeta(
      "addToHistory",
      false,
    ),
  );
  return true;
}
