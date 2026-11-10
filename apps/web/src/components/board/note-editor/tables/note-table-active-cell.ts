import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Mark the cell containing the caret, including header cells. */
export const NoteTableActiveCell = Extension.create({
  name: "noteTableActiveCell",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { $head } = state.selection;
            for (let depth = $head.depth; depth > 0; depth--) {
              const node = $head.node(depth);
              const role = node.type.spec.tableRole;
              if (role !== "cell" && role !== "header_cell") continue;
              const from = $head.before(depth);
              return DecorationSet.create(state.doc, [
                Decoration.node(from, from + node.nodeSize, {
                  class: "note-table-active-cell",
                }),
              ]);
            }
            return null;
          },
        },
      }),
    ];
  },
});
