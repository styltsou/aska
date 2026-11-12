import { type Editor } from "@tiptap/core";

import { type NoteHighlightColor } from "@/lib/note-highlights";

export function hasHighlightInSelection(editor: Editor) {
  const { selection } = editor.state;
  if (selection.empty) return false;

  let hasHighlight = false;
  editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (
      node.isText &&
      node.marks.some((mark) => mark.type.name === "highlight")
    ) {
      hasHighlight = true;
    }
    return !hasHighlight;
  });
  return hasHighlight;
}

export function replaceHighlight(editor: Editor, color: NoteHighlightColor) {
  editor.chain().focus().unsetHighlight().setHighlight({ color }).run();
}
