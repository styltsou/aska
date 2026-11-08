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

import {
  diffNoteAiDraft,
  type NoteAiDraftDiff,
} from "@/components/board/note-editor/ai/note-ai-diff";

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
  /** Where the most recently arrived content starts, to fade it in. */
  fresh: number | null;
  /** What a follow-up changed compared with the previous draft. */
  diff: NoteAiDraftDiff | null;
};

type NoteAiSessionMeta =
  | { type: "start"; range: NoteAiRange; widget: HTMLElement }
  | { type: "range"; range: NoteAiRange; fresh?: number | null }
  | { type: "streaming"; streaming: boolean }
  | { type: "diff"; diff: NoteAiDraftDiff | null }
  | { type: "end" };

const EMPTY_STATE: NoteAiSessionState = {
  range: null,
  streaming: false,
  widget: null,
  endsDoc: false,
  fresh: null,
  diff: null,
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

/** Whether `pos` lies inside the pending AI draft. */
export function isInNoteAiDraft(state: EditorState, pos: number) {
  const { range } = getNoteAiSession(state);
  return range !== null && pos >= range.from && pos < range.to;
}

/** Whether the selection overlaps the pending AI draft. */
export function selectionOverlapsNoteAiDraft(state: EditorState) {
  const { range } = getNoteAiSession(state);
  if (!range) return false;
  const { from, to } = state.selection;
  return from < range.to && to > range.from;
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
            fresh: null,
            diff: null,
          };
        }
        if (meta?.type === "end") return EMPTY_STATE;
        if (!value.range) return value;
        if (meta?.type === "diff") return { ...value, diff: meta.diff };
        if (meta?.type === "range") {
          // New content invalidates the comparison; it is redone once the
          // run finishes.
          return {
            ...value,
            range: meta.range,
            fresh: meta.fresh === undefined ? value.fresh : meta.fresh,
            diff: null,
          };
        }
        if (meta?.type === "streaming") {
          // A new run starts clean; when one ends, the last chunk (written as
          // it ends) keeps its fade.
          return {
            ...value,
            streaming: meta.streaming,
            fresh: meta.streaming ? null : value.fresh,
            diff: meta.streaming ? null : value.diff,
          };
        }
        if (!tr.docChanged) return value;

        // Content inserted at either boundary belongs outside the range.
        const from = tr.mapping.map(value.range.from, 1);
        const to = tr.mapping.map(value.range.to, -1);
        if (from >= to) return EMPTY_STATE;
        return {
          ...value,
          range: { from, to },
          fresh: value.fresh === null ? null : tr.mapping.map(value.fresh),
          diff: value.diff && mapDiff(value.diff, tr),
        };
      },
    },
    props: {
      // The AI owns its range: typing there (for example in the moment
      // before the prompt takes focus, or while output streams) would be
      // overwritten by the next update, so swallow it instead.
      handleTextInput: (view) => selectionTouchesSession(view.state),
      handlePaste: (view) => selectionTouchesSession(view.state),
      // Also refuse blocks dropped into the draft from elsewhere in the note.
      handleDrop: (view, event) => {
        if (selectionTouchesSession(view.state)) return true;
        const drop = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        return drop !== null && isInNoteAiDraft(view.state, drop.pos);
      },
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
        const { range, streaming, widget, fresh, diff } =
          getNoteAiSession(state);
        if (!range || !widget) return null;
        // The newest chunk fades in: whole blocks it added (so table and
        // code block chrome fades too) and new text inside existing blocks.
        const freshFrom = fresh !== null && fresh < range.to ? fresh : null;

        const decorations: Decoration[] = [];
        state.doc.forEach((node, offset) => {
          const end = offset + node.nodeSize;
          if (offset < range.from || end > range.to) return;
          const classes = ["note-ai-pending"];
          if (streaming) classes.push("note-ai-streaming");
          if (freshFrom !== null && offset >= freshFrom) {
            classes.push("note-ai-fresh");
          }
          decorations.push(
            Decoration.node(offset, end, { class: classes.join(" ") }),
          );
        });
        if (freshFrom !== null) {
          decorations.push(
            Decoration.inline(freshFrom, range.to, { class: "note-ai-fresh" }),
          );
        }
        if (diff) decorations.push(...diffDecorations(diff));
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

function mapDiff(diff: NoteAiDraftDiff, tr: Transaction): NoteAiDraftDiff {
  const mapRange = ({ from, to }: { from: number; to: number }) => ({
    from: tr.mapping.map(from),
    to: tr.mapping.map(to),
  });
  return {
    added: diff.added.map(mapRange),
    addedNodes: diff.addedNodes.map(mapRange),
    removed: diff.removed.map((removed) => ({
      ...removed,
      pos: tr.mapping.map(removed.pos),
    })),
  };
}

function diffDecorations(diff: NoteAiDraftDiff) {
  return [
    ...diff.added.map(({ from, to }) =>
      Decoration.inline(from, to, { class: "note-ai-added" }),
    ),
    ...diff.addedNodes.map(({ from, to }) =>
      Decoration.node(from, to, { class: "note-ai-added-block" }),
    ),
    // Removed text isn't in the document; it's drawn where it used to be, so
    // keeping the draft keeps only the new text.
    ...diff.removed.map(({ pos, text, block }, index) =>
      Decoration.widget(
        pos,
        () => {
          const element = document.createElement("del");
          element.className = block
            ? "note-ai-removed note-ai-removed-block"
            : "note-ai-removed";
          element.contentEditable = "false";
          element.textContent = text;
          return element;
        },
        {
          key: `note-ai-removed-${index}-${text}`,
          side: -1,
          marks: [],
          ignoreSelection: true,
        },
      ),
    ),
  ];
}

/**
 * Shows what the current draft changed compared with `previousMarkdown`, or
 * clears the comparison when it is null.
 */
export function setNoteAiDiffBase(
  editor: Editor,
  previousMarkdown: string | null,
) {
  const { range } = getNoteAiSession(editor.state);
  if (!range) return;
  const previous =
    previousMarkdown === null
      ? null
      : markdownToFragment(editor, previousMarkdown);
  const diff = previous
    ? diffNoteAiDraft(previous, editor.state.doc, range.from, range.to)
    : null;
  editor.view.dispatch(
    withMeta(editor.state.tr, {
      type: "diff",
      diff:
        diff &&
        (diff.added.length || diff.addedNodes.length || diff.removed.length)
          ? diff
          : null,
    }).setMeta("addToHistory", false),
  );
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
  // Where the new content first differs from what's shown: the start of the
  // chunk that just arrived (or of earlier text the new chunk reformatted).
  const diff = editor.state.doc
    .slice(range.from, range.to)
    .content.findDiffStart(fragment);
  const tr = editor.state.tr
    .replaceWith(range.from, range.to, fragment)
    .setMeta("addToHistory", false);
  withMeta(tr, {
    type: "range",
    range: { from: range.from, to: range.from + fragment.size },
    ...(diff === null ? {} : { fresh: range.from + diff }),
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
