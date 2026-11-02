import "./note-table-hover-indicators.css";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";

/** Shows alignment marks for the row and column under the pointer. */
export function NoteTableHoverIndicators({ editor }: { editor: Editor }) {
  const [hovered, setHovered] = useState<{
    wrapper: HTMLElement;
    cell: HTMLTableCellElement;
    table: HTMLTableElement;
  } | null>(null);
  const [, setLayoutVersion] = useState(0);

  useEffect(() => {
    const dom = editor.view.dom;
    const onMove = (event: PointerEvent) => {
      const target = event.target;
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
    const onLeave = () => setHovered(null);
    const onScroll = () => setLayoutVersion((version) => version + 1);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerleave", onLeave);
    dom.addEventListener("scroll", onScroll, true);
    return () => {
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerleave", onLeave);
      dom.removeEventListener("scroll", onScroll, true);
    };
  }, [editor]);

  if (!hovered || !editor.isEditable) return null;
  const { wrapper, cell, table } = hovered;
  const wrapperRect = wrapper.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  const columnCenter = cellRect.left + cellRect.width / 2 - wrapperRect.left;
  const rowCenter = cellRect.top + cellRect.height / 2 - wrapperRect.top;
  const tableLeft = tableRect.left - wrapperRect.left;
  const tableTop = tableRect.top - wrapperRect.top;

  return createPortal(
    <>
      <span
        aria-hidden="true"
        className="note-table-hover-indicator note-table-hover-indicator-column"
        style={{ left: columnCenter, top: tableTop }}
      />
      <span
        aria-hidden="true"
        className="note-table-hover-indicator note-table-hover-indicator-row"
        style={{ left: tableLeft, top: rowCenter }}
      />
    </>,
    wrapper,
  );
}
