import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { history, undo } from "@tiptap/pm/history";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";

import {
  acceptNoteAiSession,
  createNoteAiSessionPlugin,
  discardNoteAiSession,
  getNoteAiSession,
  isNoteAiSessionActive,
  NOTE_AI_CURSOR_MARKER,
  noteAiSessionBlockIndex,
  noteMarkdownAtAiCursor,
  noteAiPassageWith,
  noteMarkdownWithoutAiDraft,
  setNoteAiContent,
  showNoteAiChanges,
  startNoteAiRewrite,
  startNoteAiSession,
  startNoteAiSessionAtBlock,
} from "./note-ai-session";

// Headless Tiptap only registers plugins once mounted to a DOM, so drive the
// session helpers through a minimal editor-shaped harness on a real state.
let base: Editor | undefined;

function createHarness(markdown: string) {
  base = new Editor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: "markdown",
  });
  const markdownManager = base.markdown!;
  const saves: string[] = [];
  let state = EditorState.create({
    doc: base.state.doc,
    plugins: [history(), createNoteAiSessionPlugin()],
  });
  const getMarkdown = () => markdownManager.serialize(state.doc.toJSON());
  const dispatch = (tr: Transaction) => {
    state = state.apply(tr);
    // Mirrors NoteRichText's onUpdate: autosave is held during a session.
    if (tr.docChanged && !isNoteAiSessionActive(state)) {
      saves.push(getMarkdown());
    }
  };
  const editor = {
    get state() {
      return state;
    },
    view: { dispatch },
    schema: base.schema,
    markdown: markdownManager,
    getMarkdown,
  } as unknown as Editor;
  return { editor, saves, dispatch };
}

/** "Intro", an empty line holding the cursor, then "Outro". */
function withEmptyLine() {
  const harness = createHarness("Intro\n\nOutro");
  const { editor, dispatch } = harness;
  const intro = editor.state.doc.child(0);
  const tr = editor.state.tr.insert(
    intro.nodeSize,
    editor.schema.nodes.paragraph.create(),
  );
  tr.setSelection(TextSelection.create(tr.doc, intro.nodeSize + 1));
  dispatch(tr);
  harness.saves.length = 0;
  expect(startNoteAiSession(editor, {} as HTMLElement)).toBe(true);
  return harness;
}

afterEach(() => {
  base?.destroy();
  base = undefined;
});

describe("note AI session", () => {
  it("marks the cursor position in the context sent to the model", () => {
    const { editor } = withEmptyLine();
    const note = noteMarkdownAtAiCursor(editor);
    const cursor = note.indexOf(NOTE_AI_CURSOR_MARKER);
    expect(cursor).toBeGreaterThan(note.indexOf("Intro"));
    expect(cursor).toBeLessThan(note.indexOf("Outro"));
  });

  it("streams Markdown into the pending range without saving", () => {
    const { editor, saves } = withEmptyLine();
    setNoteAiContent(editor, "# Title");
    setNoteAiContent(editor, "# Title\n\n- one\n- two");

    const markdown = editor.getMarkdown();
    expect(markdown.indexOf("Intro")).toBeLessThan(markdown.indexOf("# Title"));
    expect(markdown.indexOf("- two")).toBeLessThan(markdown.indexOf("Outro"));
    const { range } = getNoteAiSession(editor.state);
    expect(
      editor.state.doc.slice(range!.from, range!.to).content.childCount,
    ).toBe(2);
    expect(saves).toEqual([]);
  });

  it("keeps the content as one undoable step and saves once", () => {
    const { editor, saves, dispatch } = withEmptyLine();
    const before = editor.getMarkdown();
    setNoteAiContent(editor, "Draft one");
    setNoteAiContent(editor, "Draft two\n\nSecond paragraph");
    acceptNoteAiSession(editor);

    expect(isNoteAiSessionActive(editor.state)).toBe(false);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toContain("Second paragraph");
    expect(saves[0]).not.toContain("Draft one");

    undo(editor.state, dispatch);
    expect(editor.getMarkdown()).toBe(before);
  });

  it("discards back to the original empty line", () => {
    const { editor } = withEmptyLine();
    const before = editor.getMarkdown();
    setNoteAiContent(editor, "Something");
    discardNoteAiSession(editor);

    expect(isNoteAiSessionActive(editor.state)).toBe(false);
    expect(editor.getMarkdown()).toBe(before);
    expect(editor.state.selection.$from.parent.content.size).toBe(0);
  });

  it("tracks the range through edits elsewhere in the note", () => {
    const { editor, dispatch } = withEmptyLine();
    setNoteAiContent(editor, "AI text");
    dispatch(editor.state.tr.insertText("More ", 1));
    setNoteAiContent(editor, "AI text, longer");
    acceptNoteAiSession(editor);

    const markdown = editor.getMarkdown();
    expect(markdown).toContain("More Intro");
    expect(markdown).toContain("AI text, longer");
    expect(markdown.indexOf("AI text")).toBeLessThan(markdown.indexOf("Outro"));
  });

  it("drops an empty line appended after output at the end of the note", () => {
    const harness = createHarness("Intro");
    const { editor, dispatch } = harness;
    const end = editor.state.doc.content.size;
    const tr = editor.state.tr.insert(
      end,
      editor.schema.nodes.paragraph.create(),
    );
    tr.setSelection(TextSelection.create(tr.doc, end + 1));
    dispatch(tr);
    const before = editor.getMarkdown();
    expect(startNoteAiSession(editor, {} as HTMLElement)).toBe(true);

    setNoteAiContent(editor, "- one\n- two");
    // What a trailing-node plugin does after a list ends the document.
    dispatch(
      editor.state.tr.insert(
        editor.state.doc.content.size,
        editor.schema.nodes.paragraph.create(),
      ),
    );
    discardNoteAiSession(editor);
    expect(editor.getMarkdown()).toBe(before);
  });

  it("leaves the selection alone when ending after the user clicked away", () => {
    const { editor, dispatch } = withEmptyLine();
    setNoteAiContent(editor, "AI text");
    dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 3)),
    );
    acceptNoteAiSession(editor, { select: false });
    expect(editor.state.selection.from).toBe(3);
  });

  it("saves the note without a pending draft", () => {
    const { editor } = withEmptyLine();
    const before = editor.getMarkdown();
    setNoteAiContent(editor, "# Draft\n\nMore draft");
    expect(editor.getMarkdown()).toContain("# Draft");
    expect(noteMarkdownWithoutAiDraft(editor)).toBe(before);
  });

  it("reopens a session on the same empty line by block index", () => {
    const { editor } = withEmptyLine();
    const index = noteAiSessionBlockIndex(editor.state);
    expect(index).toBe(1);
    const base = noteMarkdownWithoutAiDraft(editor);
    discardNoteAiSession(editor);

    expect(startNoteAiSessionAtBlock(editor, index!, {} as HTMLElement)).toBe(
      true,
    );
    setNoteAiContent(editor, "Restored draft");
    const markdown = editor.getMarkdown();
    expect(markdown.indexOf("Intro")).toBeLessThan(
      markdown.indexOf("Restored draft"),
    );
    expect(markdown.indexOf("Restored draft")).toBeLessThan(
      markdown.indexOf("Outro"),
    );
    expect(noteMarkdownWithoutAiDraft(editor)).toBe(base);
  });

  it("refuses to reopen a session on a line that is not empty", () => {
    const { editor } = withEmptyLine();
    discardNoteAiSession(editor);
    expect(startNoteAiSessionAtBlock(editor, 0, {} as HTMLElement)).toBe(false);
    expect(startNoteAiSessionAtBlock(editor, 99, {} as HTMLElement)).toBe(
      false,
    );
    expect(isNoteAiSessionActive(editor.state)).toBe(false);
  });

  describe("rewriting a selection", () => {
    /**
     * A note of "Intro", `paragraph` and "Outro"; selects `text` in it and
     * opens a rewrite over it.
     */
    function rewrite(paragraph: string, text: string) {
      const harness = createHarness(`Intro\n\n${paragraph}\n\nOutro`);
      const { editor, dispatch } = harness;
      let from = -1;
      editor.state.doc.descendants((node, pos) => {
        if (from < 0 && node.isText && node.text?.includes(text)) {
          from = pos + node.text.indexOf(text);
        }
      });
      dispatch(
        editor.state.tr.setSelection(
          TextSelection.create(editor.state.doc, from, from + text.length),
        ),
      );
      harness.saves.length = 0;
      expect(startNoteAiRewrite(editor, {} as HTMLElement)).toBe(true);
      return harness;
    }

    it("marks the exact selection inside the blocks it touches", () => {
      const { editor } = rewrite("Keep this. Fix this one.", "Fix this");
      expect(getNoteAiSession(editor.state).passage?.trim()).toBe(
        "Keep this. ⟦selection⟧Fix this⟦/selection⟧ one.",
      );
      expect(noteMarkdownAtAiCursor(editor)).toContain(NOTE_AI_CURSOR_MARKER);
      expect(noteMarkdownAtAiCursor(editor)).not.toContain("Keep this.");
    });

    it("keeps the selected text marked until the AI writes", () => {
      const { editor } = rewrite("Keep this. Fix this one.", "Fix this");
      const { target } = getNoteAiSession(editor.state);
      expect(editor.state.doc.textBetween(target!.from, target!.to)).toBe(
        "Fix this",
      );
      setNoteAiContent(editor, "Keep this. Fixed one.");
      expect(getNoteAiSession(editor.state).target).toBeNull();
    });

    it("widens a selection that cuts words in half to whole words", () => {
      const { editor } = rewrite("Keep this. Fix this one.", "ix thi");
      expect(getNoteAiSession(editor.state).passage?.trim()).toBe(
        "Keep this. ⟦selection⟧Fix this⟦/selection⟧ one.",
      );
    });

    it("puts the replacement back into the passage around it", () => {
      const passage = "Keep this. ⟦selection⟧Fix this⟦/selection⟧ one.";
      expect(noteAiPassageWith(passage, "Repair\nthat ")).toBe(
        "Keep this. Repair that one.",
      );
      expect(noteAiPassageWith("All of it.", "Replaced.")).toBe("Replaced.");
    });

    it("sends whole blocks without markers", () => {
      const { editor } = rewrite("All of it.", "All of it.");
      expect(getNoteAiSession(editor.state).passage?.trim()).toBe("All of it.");
    });

    it("discards back to the original text", () => {
      const { editor, saves } = rewrite("Old words here.", "Old words");
      const before = editor.getMarkdown();
      setNoteAiContent(editor, "New words here.");
      expect(noteMarkdownWithoutAiDraft(editor)).toBe(before);
      discardNoteAiSession(editor);
      expect(isNoteAiSessionActive(editor.state)).toBe(false);
      expect(editor.getMarkdown()).toBe(before);
      expect(saves).toHaveLength(1);
    });

    it("keeps the rewrite as one step that undo reverts to the original", () => {
      const { editor, dispatch, saves } = rewrite(
        "Old words here.",
        "Old words",
      );
      const before = editor.getMarkdown();
      setNoteAiContent(editor, "New words here.");
      acceptNoteAiSession(editor);
      expect(editor.getMarkdown()).toContain("New words here.");
      expect(editor.getMarkdown()).not.toContain("Old words");
      expect(saves.at(-1)).toContain("New words here.");
      undo(editor.state, dispatch);
      expect(editor.getMarkdown()).toBe(before);
    });

    it("compares the draft with the original text", () => {
      const { editor } = rewrite("Capture is fast.", "fast");
      setNoteAiContent(editor, "Capture is quick.");
      showNoteAiChanges(editor);
      const { diff } = getNoteAiSession(editor.state);
      expect(diff?.removed.map(({ text }) => text)).toEqual(["fast."]);
      expect(
        diff?.added.map(({ from, to }) =>
          editor.state.doc.textBetween(from, to),
        ),
      ).toEqual(["quick."]);
    });
  });
});
