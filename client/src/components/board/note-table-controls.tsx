import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { updateColumns } from "@tiptap/extension-table";
import { DOMSerializer } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  TableMap,
} from "@tiptap/pm/tables";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Axis = "row" | "column";
type TableDrag = {
  axis: Axis;
  start: number;
  pointerId: number;
  table: HTMLTableElement;
  originalDisplay: string;
  originalCount: number;
  amount: number;
  moved: boolean;
  preview: HTMLTableElement | null;
};

/** Controls live in the table node view so their reserved space scrolls with it. */
export function NoteTableControls({ editor }: { editor: Editor }) {
  const [wrapper, setWrapper] = useState<HTMLElement | null>(null);
  const drag = useRef<TableDrag | null>(null);

  function measureTable(table: HTMLTableElement) {
    const container = table.parentElement;
    if (!container) return;
    container.style.setProperty("--note-table-width", `${table.offsetWidth}px`);
    container.style.setProperty(
      "--note-table-height",
      `${table.offsetHeight}px`,
    );
  }

  function clearPreview(active: TableDrag) {
    active.preview?.remove();
    active.preview = null;
    active.table.style.display = active.originalDisplay;
    measureTable(active.table);
  }

  function previewSize(active: TableDrag, amount: number) {
    active.preview?.remove();
    const info = tableMap(active.table);
    if (!info) return;
    let state = EditorState.create({ doc: editor.state.doc });
    const command =
      active.axis === "row"
        ? amount > 0
          ? addRowAfter
          : deleteRow
        : amount > 0
          ? addColumnAfter
          : deleteColumn;
    for (let i = 0; i < Math.abs(amount); i++) {
      const table = state.doc.nodeAt(info.pos);
      if (!table) break;
      const map = TableMap.get(table);
      const cell = map.map[map.map.length - 1];
      if (cell === undefined) break;
      state = state.apply(
        state.tr.setSelection(
          TextSelection.near(state.doc.resolve(info.pos + 1 + cell + 1)),
        ),
      );
      if (
        !command(state, (transaction) => {
          state = state.apply(transaction);
        })
      )
        break;
    }
    const node = state.doc.nodeAt(info.pos);
    if (!node) return;
    const preview = active.table.cloneNode(false) as HTMLTableElement;
    const columns = document.createElement("colgroup");
    preview.appendChild(columns);
    updateColumns(node, columns, preview, 25);
    const body = document.createElement("tbody");
    body.appendChild(
      DOMSerializer.fromSchema(editor.schema).serializeFragment(node.content),
    );
    // ProseMirror supplies a trailing break in empty paragraphs to give them
    // their normal line height; the schema serializer does not include it.
    for (const paragraph of body.querySelectorAll("p:empty")) {
      const br = document.createElement("br");
      br.className = "ProseMirror-trailingBreak";
      paragraph.appendChild(br);
    }
    preview.appendChild(body);
    preview.style.display = active.originalDisplay;
    preview.contentEditable = "false";
    preview.setAttribute("aria-hidden", "true");
    preview.style.pointerEvents = "none";

    active.table.style.display = "none";
    active.table.parentElement?.appendChild(preview);
    active.preview = preview;
    measureTable(preview);
    const viewport = preview.closest<HTMLElement>(".note-table-viewport");
    if (active.axis === "column" && amount > 0 && viewport) {
      viewport.scrollLeft = viewport.scrollWidth;
    }
  }

  function tableMap(table: HTMLTableElement) {
    try {
      const resolved = editor.state.doc.resolve(editor.view.posAtDOM(table, 0));
      let depth = resolved.depth;
      while (depth > 0 && resolved.node(depth).type.name !== "table") depth--;
      return depth
        ? {
            pos: resolved.before(depth),
            map: TableMap.get(resolved.node(depth)),
          }
        : null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const dom = editor.view.dom;
    const onMove = (event: PointerEvent) => {
      if (drag.current) return;
      const target = event.target;
      const next =
        target instanceof Element
          ? target.closest<HTMLElement>(".tableWrapper")
          : null;
      setWrapper(next && dom.contains(next) ? next : null);
    };
    const onLeave = () => {
      if (!drag.current) setWrapper(null);
    };
    const onPointerMove = (event: PointerEvent) => {
      const target = event.target;
      const container =
        target instanceof Element
          ? target.closest<HTMLElement>(".tableWrapper")
          : null;
      const table = container?.querySelector(
        "table:not([style*='display: none'])",
      );
      if (!container || !table) return;
      const rect = table.getBoundingClientRect();
      container.toggleAttribute(
        "data-near-row-control",
        event.clientY >= rect.bottom - 48 &&
          event.clientY <= rect.bottom + 20 &&
          event.clientX >= rect.left &&
          event.clientX <= rect.right,
      );
      container.toggleAttribute(
        "data-near-column-control",
        event.clientX >= rect.right - 48 &&
          event.clientX <= rect.right + 20 &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      );
    };
    dom.addEventListener("pointerover", onMove);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onLeave);
    return () => {
      if (drag.current) clearPreview(drag.current);
      dom.removeEventListener("pointerover", onMove);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onLeave);
    };
  }, [editor]);

  useEffect(() => {
    const table = wrapper?.querySelector("table");
    if (!wrapper || !table) return;
    const observer = new ResizeObserver(() => {
      const visible = drag.current?.preview ?? table;
      measureTable(visible);
    });
    observer.observe(wrapper);
    observer.observe(table);
    measureTable(table);
    return () => observer.disconnect();
  }, [wrapper]);

  function changeSize(axis: Axis, amount: number) {
    const table = wrapper?.querySelector("table");
    if (!table || !editor.isEditable || !amount) return;
    const tablePos = tableMap(table)?.pos;
    if (tablePos === undefined) return;
    for (let i = 0; i < Math.abs(amount); i++) {
      const node = editor.state.doc.nodeAt(tablePos);
      if (!node || node.type.name !== "table") break;
      const map = TableMap.get(node);
      if (amount < 0 && (axis === "row" ? map.height : map.width) <= 1) break;
      const cell = map.map[map.map.length - 1];
      if (cell === undefined) break;
      const chain = editor.chain().setTextSelection(tablePos + 1 + cell + 1);
      const command =
        axis === "row"
          ? amount > 0
            ? chain.addRowAfter()
            : chain.deleteRow()
          : amount > 0
            ? chain.addColumnAfter()
            : chain.deleteColumn();
      if (!command.run()) break;
    }
    if (axis === "column" && amount > 0) {
      requestAnimationFrame(() => {
        const viewport = table.closest<HTMLElement>(".note-table-viewport");
        if (viewport) viewport.scrollLeft = viewport.scrollWidth;
      });
    }
  }

  function control(axis: Axis) {
    const label = axis === "row" ? "row" : "column";
    return (
      <Tooltip key={axis}>
        <TooltipTrigger
          delay={0}
          render={
            <button
              type="button"
              className={`note-table-control note-table-control-${axis}`}
              aria-label={`Add ${label}; drag to add or remove ${label}s`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const table = wrapper?.querySelector("table");
                const info = table && tableMap(table);
                if (!table || !info) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.dataset.dragging = "true";
                drag.current = {
                  axis,
                  start: axis === "row" ? event.clientY : event.clientX,
                  pointerId: event.pointerId,
                  table,
                  originalDisplay: table.style.display,
                  originalCount:
                    axis === "row" ? info.map.height : info.map.width,
                  amount: 0,
                  moved: false,
                  preview: null,
                };
              }}
              onPointerMove={(event) => {
                const active = drag.current;
                if (!active || active.pointerId !== event.pointerId) return;
                const distance =
                  (axis === "row" ? event.clientY : event.clientX) -
                  active.start;
                if (Math.abs(distance) >= 6) active.moved = true;
                if (!active.moved) return;
                const amount = Math.max(
                  1 - active.originalCount,
                  Math.trunc(distance / (axis === "row" ? 32 : 100)),
                );
                if (amount === active.amount && active.preview) return;
                active.amount = amount;
                previewSize(active, amount);
              }}
              onPointerUp={(event) => {
                const active = drag.current;
                if (!active || active.pointerId !== event.pointerId) return;
                delete event.currentTarget.dataset.dragging;
                drag.current = null;
                clearPreview(active);
                changeSize(axis, active.moved ? active.amount : 1);
              }}
              onPointerCancel={(event) => {
                delete event.currentTarget.dataset.dragging;
                if (drag.current) clearPreview(drag.current);
                drag.current = null;
              }}
              onClick={(event) => {
                if (event.detail === 0) changeSize(axis, 1);
              }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
            </button>
          }
        />
        <TooltipContent
          side="bottom"
          className="block space-y-1 text-center transition-none"
        >
          <div>
            <span className="font-semibold text-foreground">Click</span>
            <span className="text-muted-foreground"> to add {label}</span>
          </div>
          <div>
            <span className="font-semibold text-foreground">Drag</span>
            <span className="text-muted-foreground">
              {" "}
              to add or remove {label}s
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return wrapper && editor.isEditable
    ? createPortal(
        <>
          {control("row")}
          {control("column")}
        </>,
        wrapper,
      )
    : null;
}
