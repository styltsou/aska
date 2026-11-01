import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { TableView } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Keep Tiptap's table and editable tbody inside the shared scroll-area viewport. */
export class NoteTableView extends TableView {
  private readonly reactRoot: Root;

  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    view: EditorView,
    attributes: Record<string, unknown> = {},
  ) {
    super(node, cellMinWidth, view, attributes);
    const table = this.table;
    const host = document.createElement("div");
    this.dom = host;
    this.reactRoot = createRoot(host);
    flushSync(() => {
      this.reactRoot.render(
        <ScrollArea
          className="note-table-scroll-area"
          viewportClassName="h-auto note-table-viewport"
          contentClassName="tableWrapper"
          contentStyle={{ width: "max-content", minWidth: "100%" }}
          contentRef={(content) => {
            if (content && table.parentElement !== content)
              content.appendChild(table);
          }}
          verticalScrollbarClassName="hidden"
          horizontalScrollbarClassName="note-table-scrollbar"
          horizontalScrollbarStyle={{
            position: "relative",
            insetInlineStart: "auto",
            insetInlineEnd: "auto",
            bottom: "auto",
            opacity: 1,
          }}
          horizontalThumbClassName="note-table-scrollbar-thumb"
        />,
      );
    });
  }

  destroy() {
    // ProseMirror can destroy node views during React's own commit.
    queueMicrotask(() => this.reactRoot.unmount());
  }
}
