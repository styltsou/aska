import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import { diffNoteAgentDraft } from "./note-agent-diff";

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

/** The note holds `after` between an intro and an outro paragraph. */
function compare(before: string, after: string) {
  editor = new Editor({
    extensions: [StarterKit, Markdown],
    content: `Intro\n\n${after}\n\nOutro`,
    contentType: "markdown",
  });
  const { doc } = editor.state;
  const from = doc.child(0).nodeSize;
  const to = doc.content.size - doc.lastChild!.nodeSize;
  const previous = editor.schema.nodeFromJSON(
    editor.markdown!.parse(before),
  ).content;
  const diff = diffNoteAgentDraft(previous, doc, from, to);
  return {
    diff,
    added: diff.added.map(({ from, to }) => doc.textBetween(from, to)),
    removed: diff.removed.map(({ text }) => text),
    doc,
  };
}

describe("diffNoteAgentDraft", () => {
  it("finds nothing when the draft is unchanged", () => {
    const { diff } = compare("Same words here.", "Same words here.");
    expect(diff).toEqual({ added: [], addedNodes: [], removed: [] });
  });

  it("highlights replaced words and keeps the removed ones in place", () => {
    const { added, removed, diff, doc } = compare(
      "Scratchpads keep capture fast and simple.",
      "Scratchpads keep capture quick and simple.",
    );
    expect(added).toEqual(["quick"]);
    expect(removed).toEqual(["fast"]);
    // Shown right before the new word.
    expect(
      doc.textBetween(diff.removed[0]!.pos, diff.removed[0]!.pos + 5),
    ).toBe("quick");
  });

  it("joins neighboring new words into one highlight", () => {
    const { added } = compare(
      "One inbox.",
      "One inbox means less sorting later.",
    );
    expect(added).toEqual(["inbox means less sorting later."]);
  });

  it("marks a whole new paragraph and a removed one", () => {
    const { added, removed } = compare(
      "First stays.\n\nSecond goes away.",
      "First stays.\n\nA new ending.",
    );
    expect(added).toEqual(["A new ending."]);
    expect(removed).toEqual(["Second goes away."]);
  });

  it("puts a removed list item on its own line after the one before it", () => {
    const { removed, diff, doc } = compare(
      "- first\n- gone item\n- last",
      "- first\n- last",
    );
    expect(removed).toEqual(["gone item"]);
    expect(diff.removed[0]!.block).toBe(true);
    expect(doc.resolve(diff.removed[0]!.pos).parent.textContent).toBe("first");
  });

  it("compares text inside lists and code blocks", () => {
    const { added, removed } = compare(
      "- fast capture\n\n```ts\nconst a = 1;\n```",
      "- quick capture\n\n```ts\nconst a = 2;\n```",
    );
    expect(added).toEqual(["quick", "2;"]);
    expect(removed).toEqual(["fast", "1;"]);
  });

  it("places removed trailing text at the end of the draft", () => {
    const { removed, diff, doc } = compare(
      "Keep this. Drop this.",
      "Keep this.",
    );
    expect(removed).toEqual(["Drop this."]);
    expect(doc.resolve(diff.removed[0]!.pos).parent.textContent).toBe(
      "Keep this.",
    );
  });
});
