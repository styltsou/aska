import "./note-table-hover-indicators.css";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { moveTableColumn, moveTableRow, TableMap } from "@tiptap/pm/tables";

type Axis = "row" | "column";
type Hovered = {
  wrapper: HTMLElement;
  cell: HTMLTableCellElement;
  table: HTMLTableElement;
};
type Drag = {
  axis: Axis;
  from: number;
  boundary: number;
  pointerId: number;
  table: HTMLTableElement;
  pos: number;
  moved: boolean;
  start: number;
  end: number;
  placeholder: HTMLTableElement | null;
  preview: HTMLTableElement | null;
  outline: HTMLDivElement | null;
  handle: HTMLButtonElement;
  floatingHandle: HTMLDivElement | null;
};

function clearDragPreview(active: Drag) {
  active.placeholder?.remove();
  active.preview?.remove();
  active.outline?.remove();
  active.floatingHandle?.remove();
  active.placeholder = null;
  active.preview = null;
  active.outline = null;
  active.floatingHandle = null;
}

function showDragPreview(
  active: Drag,
  wrapper: HTMLElement,
  coordinate: number,
  count: number,
) {
  const tableRect = active.table.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  const edges = boundaries(active.table, active.axis, count);
  const start =
    edges[active.from] -
    (active.axis === "row" ? tableRect.top : tableRect.left);
  const end =
    edges[active.end] -
    (active.axis === "row" ? tableRect.top : tableRect.left);
  const clip =
    active.axis === "row"
      ? `inset(${start}px 0 ${Math.max(0, tableRect.height - end)}px 0)`
      : `inset(0 ${Math.max(0, tableRect.width - end)}px 0 ${start}px)`;

  if (
    !active.preview ||
    !active.placeholder ||
    !active.outline ||
    !active.floatingHandle
  ) {
    const clone = (className: string) => {
      const copy = active.table.cloneNode(true) as HTMLTableElement;
      copy.classList.add("note-table-drag-copy", className);
      copy.setAttribute("aria-hidden", "true");
      copy.inert = true;
      wrapper.appendChild(copy);
      return copy;
    };
    active.placeholder = clone("note-table-drag-placeholder");
    active.preview = clone("note-table-drag-preview");
    active.outline = document.createElement("div");
    active.outline.className = "note-table-drag-outline";
    active.outline.setAttribute("aria-hidden", "true");
    wrapper.appendChild(active.outline);
    active.floatingHandle = document.createElement("div");
    active.floatingHandle.className = `note-table-drag-handle note-table-drag-handle-${active.axis}`;
    active.floatingHandle.setAttribute("aria-hidden", "true");
    const icon = active.handle.querySelector("svg");
    if (icon) active.floatingHandle.appendChild(icon.cloneNode(true));
    wrapper.appendChild(active.floatingHandle);
  }
  for (const copy of [active.placeholder, active.preview]) {
    copy.style.left = `${tableRect.left - wrapperRect.left}px`;
    copy.style.top = `${tableRect.top - wrapperRect.top}px`;
    copy.style.width = `${tableRect.width}px`;
    copy.style.height = `${tableRect.height}px`;
    copy.style.clipPath = clip;
  }
  const distance = coordinate - active.start;
  active.outline.style.left = `${tableRect.left - wrapperRect.left + (active.axis === "column" ? start : 0)}px`;
  active.outline.style.top = `${tableRect.top - wrapperRect.top + (active.axis === "row" ? start : 0)}px`;
  active.outline.style.width = `${active.axis === "column" ? end - start : tableRect.width}px`;
  active.outline.style.height = `${active.axis === "row" ? end - start : tableRect.height}px`;
  active.outline.style.transform =
    active.axis === "row"
      ? `translateY(${distance}px)`
      : `translateX(${distance}px)`;
  active.floatingHandle.style.left = `${tableRect.left - wrapperRect.left + (active.axis === "column" ? (start + end) / 2 + distance : 0.5)}px`;
  active.floatingHandle.style.top = `${tableRect.top - wrapperRect.top + (active.axis === "row" ? (start + end) / 2 + distance : 0.5)}px`;
  active.preview.style.transform =
    active.axis === "row"
      ? `translateY(${distance}px)`
      : `translateX(${distance}px)`;
}

function tableInfo(editor: Editor, cell: HTMLTableCellElement) {
  try {
    const $cell = editor.state.doc.resolve(editor.view.posAtDOM(cell, 0));
    let depth = $cell.depth;
    while (depth > 0 && $cell.node(depth).type.name !== "table") depth--;
    if (!depth) return null;
    const pos = $cell.before(depth);
    const map = TableMap.get($cell.node(depth));
    const cellPos = $cell.before(depth + 2);
    const rect = map.findCell(cellPos - pos - 1);
    return { pos, map, rect };
  } catch {
    return null;
  }
}

function boundaries(table: HTMLTableElement, axis: Axis, count: number) {
  const tableRect = table.getBoundingClientRect();
  if (axis === "row") {
    const rows = Array.from(table.rows);
    return [
      ...rows.map((row) => row.getBoundingClientRect().top),
      tableRect.bottom,
    ];
  }
  // Column widths are represented by the colgroup, including for merged cells.
  const cols = Array.from(table.querySelectorAll("colgroup col"));
  if (cols.length === count) {
    return [
      ...cols.map((col) => col.getBoundingClientRect().left),
      tableRect.right,
    ];
  }
  return Array.from(
    { length: count + 1 },
    (_, i) => tableRect.left + (tableRect.width * i) / count,
  );
}

/** Edge marks become drag handles for moving the hovered row or column. */
export function NoteTableHoverIndicators({ editor }: { editor: Editor }) {
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [drop, setDrop] = useState<{ axis: Axis; coordinate: number } | null>(
    null,
  );
  const [, setLayoutVersion] = useState(0);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;
    const onMove = (event: PointerEvent) => {
      if (drag.current) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".note-table-hover-indicator")
      )
        return;
      const cell =
        target instanceof Element
          ? target.closest<HTMLTableCellElement>("td, th")
          : null;
      const table = cell?.closest<HTMLTableElement>("table");
      const wrapper = table?.closest<HTMLElement>(".tableWrapper");
      if (!cell || !table || !wrapper || !dom.contains(wrapper)) {
        setHovered(null);
        return;
      }
      setHovered((current) =>
        current?.cell === cell ? current : { wrapper, cell, table },
      );
    };
    const onLeave = () => {
      if (!drag.current) setHovered(null);
    };
    const onScroll = () => setLayoutVersion((version) => version + 1);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("scroll", onScroll, true);
    return () => {
      if (drag.current) clearDragPreview(drag.current);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("scroll", onScroll, true);
    };
  }, [editor]);

  if (!hovered || !editor.isEditable) return null;
  const { wrapper, cell, table } = hovered;
  const info = tableInfo(editor, cell);
  if (!info) return null;
  const wrapperRect = wrapper.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const columnCenter = cellRect.left + cellRect.width / 2 - wrapperRect.left;
  const rowCenter = cellRect.top + cellRect.height / 2 - wrapperRect.top;
  const tableLeft = tableRect.left - wrapperRect.left;
  const tableTop = tableRect.top - wrapperRect.top;

  function move(axis: Axis, from: number, to: number, pos: number) {
    if (from === to) return;
    const command = axis === "row" ? moveTableRow : moveTableColumn;
    const tableNode = editor.state.doc.nodeAt(pos);
    if (!tableNode) return;
    const firstCell = TableMap.get(tableNode).map[0];
    if (firstCell === undefined) return;
    // The move helpers resolve merged-cell ranges from the current selection.
    const state = editor.state.apply(
      editor.state.tr.setSelection(
        TextSelection.near(editor.state.doc.resolve(pos + 1 + firstCell + 1)),
      ),
    );
    command({ from, to, pos: pos + 1, select: false })(
      state,
      editor.view.dispatch,
    );
    editor.view.focus();
    setHovered(null);
  }

  function handle(axis: Axis) {
    const index = axis === "row" ? info!.rect.top : info!.rect.left;
    const count = axis === "row" ? info!.map.height : info!.map.width;
    const position =
      axis === "column"
        ? { left: columnCenter, top: tableTop + 0.5 }
        : { left: tableLeft + 0.5, top: rowCenter };
    return (
      <Fragment key={axis}>
        <button
          type="button"
          aria-label={`Move ${axis} ${index + 1}`}
          title={`Drag to move ${axis}; use arrow keys to move`}
          className={`note-table-hover-indicator note-table-hover-indicator-${axis}`}
          style={position}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.dragging = "true";
            drag.current = {
              axis,
              from: index,
              boundary: index,
              pointerId: event.pointerId,
              table,
              pos: info!.pos,
              moved: false,
              start: axis === "row" ? event.clientY : event.clientX,
              end: axis === "row" ? info!.rect.bottom : info!.rect.right,
              placeholder: null,
              preview: null,
              outline: null,
              handle: event.currentTarget,
              floatingHandle: null,
            };
          }}
          onPointerMove={(event) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            const coordinate = axis === "row" ? event.clientY : event.clientX;
            if (Math.abs(coordinate - active.start) < 5 && !active.moved)
              return;
            active.moved = true;
            showDragPreview(active, wrapper, coordinate, count);
            const edges = boundaries(active.table, axis, count);
            const distance = coordinate - active.start;
            const edgeOffset = axis === "row" ? 30 : 48;
            let boundary = active.end;
            if (distance > 0) {
              // Wait until the dragged item's trailing edge nearly reaches the
              // next slot before offering a destination past that slot.
              const trailingEdge = edges[active.from] + distance;
              for (let i = active.end + 1; i <= count; i++) {
                if (trailingEdge >= edges[i - 1] - edgeOffset) boundary = i;
              }
            } else {
              const trailingEdge = edges[active.end] + distance;
              for (let i = active.from - 1; i >= 0; i--) {
                if (trailingEdge <= edges[i + 1] + edgeOffset) boundary = i;
              }
            }
            active.boundary = boundary;
            if (boundary >= active.from && boundary <= active.end) {
              setDrop(null);
              return;
            }
            const rect = wrapper.getBoundingClientRect();
            setDrop({
              axis,
              coordinate:
                edges[boundary] - (axis === "row" ? rect.top : rect.left),
            });
          }}
          onPointerUp={(event) => {
            const active = drag.current;
            if (!active || active.pointerId !== event.pointerId) return;
            delete event.currentTarget.dataset.dragging;
            drag.current = null;
            clearDragPreview(active);
            setDrop(null);
            if (active.moved)
              move(
                axis,
                active.from,
                active.boundary > active.from
                  ? active.boundary - 1
                  : active.boundary,
                active.pos,
              );
          }}
          onPointerCancel={(event) => {
            delete event.currentTarget.dataset.dragging;
            if (drag.current) clearDragPreview(drag.current);
            drag.current = null;
            setDrop(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && drag.current) {
              delete event.currentTarget.dataset.dragging;
              clearDragPreview(drag.current);
              drag.current = null;
              setDrop(null);
              return;
            }
            const previous = axis === "row" ? "ArrowUp" : "ArrowLeft";
            const next = axis === "row" ? "ArrowDown" : "ArrowRight";
            if (event.key !== previous && event.key !== next) return;
            event.preventDefault();
            move(
              axis,
              index,
              Math.max(
                0,
                Math.min(count - 1, index + (event.key === previous ? -1 : 1)),
              ),
              info!.pos,
            );
          }}
        >
          <svg
            className="note-table-indicator-grip"
            viewBox="0 0 14 12"
            aria-hidden="true"
          >
            <circle cx="3" cy="4" r="1" />
            <circle cx="7" cy="4" r="1" />
            <circle cx="11" cy="4" r="1" />
            <circle cx="3" cy="8" r="1" />
            <circle cx="7" cy="8" r="1" />
            <circle cx="11" cy="8" r="1" />
          </svg>
        </button>
        <span
          aria-hidden="true"
          className={`note-table-indicator-dash note-table-indicator-dash-${axis}`}
          style={position}
        />
      </Fragment>
    );
  }

  return createPortal(
    <>
      {handle("column")}
      {handle("row")}
      {drop && (
        <span
          aria-hidden="true"
          className={`note-table-drop-indicator note-table-drop-indicator-${drop.axis}`}
          style={
            drop.axis === "row"
              ? {
                  top: drop.coordinate,
                  left: tableLeft,
                  width: tableRect.width,
                }
              : {
                  left: drop.coordinate,
                  top: tableTop,
                  height: tableRect.height,
                }
          }
        />
      )}
    </>,
    wrapper,
  );
}
