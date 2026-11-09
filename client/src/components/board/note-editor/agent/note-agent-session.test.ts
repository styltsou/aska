import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { history, undo } from "@tiptap/pm/history";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";

import {
  acceptNoteAgentSession,
  createNoteAgentSessionPlugin,
  discardNoteAgentSession,
  getNoteAgentSession,
  isNoteAgentSessionActive,
  NOTE_AGENT_CURSOR_MARKER,
  noteAgentSessionBlockIndex,
  noteMarkdownAtAgentCursor,
  noteAgentPassageWith,
  noteMarkdownWithoutAgentDraft,
  setNoteAgentContent,
  showNoteAgentChanges,
  startNoteAgentRewrite,
  startNoteAgentSession,
  startNoteAgentSessionAtBlock,
} from "./note-agent-session";

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
    plugins: [history(), createNoteAgentSessionPlugin()],
  });
  const getMarkdown = () => markdownManager.serialize(state.doc.toJSON());
  const dispatch = (tr: Transaction) => {
    state = state.apply(tr);
    // Mirrors NoteRichText's onUpdate: autosave is held during a session.
    if (tr.docChanged && !isNoteAgentSessionActive(state)) {
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
  expect(startNoteAgentSession(editor, {} as HTMLElement)).toBe(true);
  return harness;
}

afterEach(() => {
  base?.destroy();
  base = undefined;
});

describe("note agent session", () => {
  it("marks the cursor position in the context sent to the model", () => {
    const { editor } = withEmptyLine();
    const note = noteMarkdownAtAgentCursor(editor);
    const cursor = note.indexOf(NOTE_AGENT_CURSOR_MARKER);
    expect(cursor).toBeGreaterThan(note.indexOf("Intro"));
    expect(cursor).toBeLessThan(note.indexOf("Outro"));
  });

  it("streams Markdown into the pending range without saving", () => {
    const { editor, saves } = withEmptyLine();
    setNoteAgentContent(editor, "# Title");
    setNoteAgentContent(editor, "# Title\n\n- one\n- two");

    const markdown = editor.getMarkdown();
    expect(markdown.indexOf("Intro")).toBeLessThan(markdown.indexOf("# Title"));
    expect(markdown.indexOf("- two")).toBeLessThan(markdown.indexOf("Outro"));
    const { range } = getNoteAgentSession(editor.state);
    expect(
      editor.state.doc.slice(range!.from, range!.to).content.childCount,
    ).toBe(2);
    expect(saves).toEqual([]);
  });

  it("keeps the content as one undoable step and saves once", () => {
    const { editor, saves, dispatch } = withEmptyLine();
    const before = editor.getMarkdown();
    setNoteAgentContent(editor, "Draft one");
    setNoteAgentContent(editor, "Draft two\n\nSecond paragraph");
    acceptNoteAgentSession(editor);

    expect(isNoteAgentSessionActive(editor.state)).toBe(false);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toContain("Second paragraph");
    expect(saves[0]).not.toContain("Draft one");

    undo(editor.state, dispatch);
    expect(editor.getMarkdown()).toBe(before);
  });

  it("discards back to the original empty line", () => {
    const { editor } = withEmptyLine();
    const before = editor.getMarkdown();
    setNoteAgentContent(editor, "Something");
    discardNoteAgentSession(editor);

    expect(isNoteAgentSessionActive(editor.state)).toBe(false);
    expect(editor.getMarkdown()).toBe(before);
    expect(editor.state.selection.$from.parent.content.size).toBe(0);
  });

  it("tracks the range through edits elsewhere in the note", () => {
    const { editor, dispatch } = withEmptyLine();
    setNoteAgentContent(editor, "AI text");
    dispatch(editor.state.tr.insertText("More ", 1));
    setNoteAgentContent(editor, "AI text, longer");
    acceptNoteAgentSession(editor);

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
    expect(startNoteAgentSession(editor, {} as HTMLElement)).toBe(true);

    setNoteAgentContent(editor, "- one\n- two");
    // What a trailing-node plugin does after a list ends the document.
    dispatch(
      editor.state.tr.insert(
        editor.state.doc.content.size,
        editor.schema.nodes.paragraph.create(),
      ),
    );
    discardNoteAgentSession(editor);
    expect(editor.getMarkdown()).toBe(before);
  });

  it("leaves the selection alone when ending after the user clicked away", () => {
    const { editor, dispatch } = withEmptyLine();
    setNoteAgentContent(editor, "AI text");
    dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 3)),
    );
    acceptNoteAgentSession(editor, { select: false });
    expect(editor.state.selection.from).toBe(3);
  });

  it("saves the note without a pending draft", () => {
    const { editor } = withEmptyLine();
    const before = editor.getMarkdown();
    setNoteAgentContent(editor, "# Draft\n\nMore draft");
    expect(editor.getMarkdown()).toContain("# Draft");
    expect(noteMarkdownWithoutAgentDraft(editor)).toBe(before);
  });

  it("reopens a session on the same empty line by block index", () => {
    const { editor } = withEmptyLine();
    const index = noteAgentSessionBlockIndex(editor.state);
    expect(index).toBe(1);
    const base = noteMarkdownWithoutAgentDraft(editor);
    discardNoteAgentSession(editor);

    expect(
      startNoteAgentSessionAtBlock(editor, index!, {} as HTMLElement),
    ).toBe(true);
    setNoteAgentContent(editor, "Restored draft");
    const markdown = editor.getMarkdown();
    expect(markdown.indexOf("Intro")).toBeLessThan(
      markdown.indexOf("Restored draft"),
    );
    expect(markdown.indexOf("Restored draft")).toBeLessThan(
      markdown.indexOf("Outro"),
    );
    expect(noteMarkdownWithoutAgentDraft(editor)).toBe(base);
  });

  it("refuses to reopen a session on a line that is not empty", () => {
    const { editor } = withEmptyLine();
    discardNoteAgentSession(editor);
    expect(startNoteAgentSessionAtBlock(editor, 0, {} as HTMLElement)).toBe(
      false,
    );
    expect(startNoteAgentSessionAtBlock(editor, 99, {} as HTMLElement)).toBe(
      false,
    );
    expect(isNoteAgentSessionActive(editor.state)).toBe(false);
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
      expect(startNoteAgentRewrite(editor, {} as HTMLElement)).toBe(true);
      return harness;
    }

    it("marks the exact selection inside the blocks it touches", () => {
      const { editor } = rewrite("Keep this. Fix this one.", "Fix this");
      expect(getNoteAgentSession(editor.state).passage?.trim()).toBe(
        "Keep this. ⟦selection⟧Fix this⟦/selection⟧ one.",
      );
      expect(noteMarkdownAtAgentCursor(editor)).toContain(
        NOTE_AGENT_CURSOR_MARKER,
      );
      expect(noteMarkdownAtAgentCursor(editor)).not.toContain("Keep this.");
    });

    it("keeps the selected text marked until the agent writes", () => {
      const { editor } = rewrite("Keep this. Fix this one.", "Fix this");
      const { target } = getNoteAgentSession(editor.state);
      expect(editor.state.doc.textBetween(target!.from, target!.to)).toBe(
        "Fix this",
      );
      setNoteAgentContent(editor, "Keep this. Fixed one.");
      expect(getNoteAgentSession(editor.state).target).toBeNull();
    });

    it("widens a selection that cuts words in half to whole words", () => {
      const { editor } = rewrite("Keep this. Fix this one.", "ix thi");
      expect(getNoteAgentSession(editor.state).passage?.trim()).toBe(
        "Keep this. ⟦selection⟧Fix this⟦/selection⟧ one.",
      );
    });

    it("puts the replacement back into the passage around it", () => {
      const passage = "Keep this. ⟦selection⟧Fix this⟦/selection⟧ one.";
      expect(noteAgentPassageWith(passage, "Repair\nthat ")).toBe(
        "Keep this. Repair that one.",
      );
      expect(noteAgentPassageWith("All of it.", "Replaced.")).toBe("Replaced.");
    });

    it("sends whole blocks without markers", () => {
      const { editor } = rewrite("All of it.", "All of it.");
      expect(getNoteAgentSession(editor.state).passage?.trim()).toBe(
        "All of it.",
      );
    });

    it("discards back to the original text", () => {
      const { editor, saves } = rewrite("Old words here.", "Old words");
      const before = editor.getMarkdown();
      setNoteAgentContent(editor, "New words here.");
      expect(noteMarkdownWithoutAgentDraft(editor)).toBe(before);
      discardNoteAgentSession(editor);
      expect(isNoteAgentSessionActive(editor.state)).toBe(false);
      expect(editor.getMarkdown()).toBe(before);
      expect(saves).toHaveLength(1);
    });

    it("keeps the rewrite as one step that undo reverts to the original", () => {
      const { editor, dispatch, saves } = rewrite(
        "Old words here.",
        "Old words",
      );
      const before = editor.getMarkdown();
      setNoteAgentContent(editor, "New words here.");
      acceptNoteAgentSession(editor);
      expect(editor.getMarkdown()).toContain("New words here.");
      expect(editor.getMarkdown()).not.toContain("Old words");
      expect(saves.at(-1)).toContain("New words here.");
      undo(editor.state, dispatch);
      expect(editor.getMarkdown()).toBe(before);
    });

    it("compares the draft with the original text", () => {
      const { editor } = rewrite("Capture is fast.", "fast");
      setNoteAgentContent(editor, "Capture is quick.");
      showNoteAgentChanges(editor);
      const { diff } = getNoteAgentSession(editor.state);
      expect(diff?.removed.map(({ text }) => text)).toEqual(["fast."]);
      expect(
        diff?.added.map(({ from, to }) =>
          editor.state.doc.textBetween(from, to),
        ),
      ).toEqual(["quick."]);
    });
  });
});
