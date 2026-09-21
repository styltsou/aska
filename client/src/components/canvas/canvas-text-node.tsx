import { useLayoutEffect, useRef, useState } from "react";
import { type Node, type NodeProps, type XYPosition } from "@xyflow/react";

import type { CanvasTextObject } from "@/api/collection";
import { cn } from "@/lib/utils";
import { canvasObjectColor, canvasTextTypography } from "./canvas-object-style";
import { OVERLAY_Z_INDEX } from "./canvas-node-stacking";

export type CanvasTextNodeData = {
  object: CanvasTextObject;
  editing: boolean;
  onSelect: (id: string, event: React.MouseEvent) => void;
  onPointerDown: (id: string, event: React.PointerEvent) => void;
  onBeginEdit: (id: string) => void;
  onCommit: (id: string, content: string) => void;
};

export type CanvasTextFlowNode = Node<CanvasTextNodeData, "text">;

export function insertCanvasPlainText(
  content: string,
  pastedText: string,
  selectionStart: number,
  selectionEnd: number,
) {
  const nextContent =
    content.slice(0, selectionStart) + pastedText + content.slice(selectionEnd);
  const cursor = selectionStart + pastedText.length;

  return { content: nextContent, cursor };
}

export function CanvasTextNode({
  data,
  selected,
}: NodeProps<CanvasTextFlowNode>) {
  const typography = canvasTextTypography(data.object.font, data.object.size);

  return (
    <div
      className={cn(
        "group/text relative inline-block min-h-7 rounded-sm px-2 py-1.5",
        selected && "ring-2 ring-primary",
      )}
      style={{ color: canvasObjectColor(data.object.color) }}
      data-selection-node-id={data.object.id}
      onPointerDown={(event) => data.onPointerDown(data.object.id, event)}
      onClick={(event) => data.onSelect(data.object.id, event)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        data.onBeginEdit(data.object.id);
      }}
    >
      {!data.editing ? (
        <p
          className={cn("whitespace-pre", typography.className)}
          style={typography.style}
        >
          {data.object.content}
        </p>
      ) : null}
    </div>
  );
}

export function CanvasTextEditor({
  object,
  position,
  onCommit,
}: {
  object: CanvasTextObject;
  position: XYPosition;
  onCommit: (id: string, content: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedRef = useRef(false);
  const [content, setContent] = useState(object.content);
  const typography = canvasTextTypography(object.font, object.size);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(24, textarea.scrollHeight)}px`;
  }, [content, object.font, object.size]);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    onCommit(object.id, content);
  };

  return (
    <textarea
      ref={textareaRef}
      className={cn(
        "nodrag nopan nowheel field-sizing-content absolute block min-w-6 max-w-none resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-none placeholder:text-current/35",
        typography.className,
      )}
      style={{
        left: position.x + 4,
        top: position.y + 2,
        color: canvasObjectColor(object.color),
        pointerEvents: "all",
        zIndex: OVERLAY_Z_INDEX,
        ...typography.style,
      }}
      value={content}
      placeholder="Type something…"
      rows={1}
      wrap="off"
      maxLength={2_000}
      aria-label="Canvas text"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onChange={(event) => setContent(event.currentTarget.value)}
      onPaste={(event) => {
        const pastedText = event.clipboardData.getData("text/plain");
        if (!pastedText && !event.clipboardData.types.includes("text/plain")) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        const { content: nextContent, cursor } = insertCanvasPlainText(
          content,
          pastedText,
          event.currentTarget.selectionStart,
          event.currentTarget.selectionEnd,
        );
        setContent(nextContent);
        requestAnimationFrame(() => {
          textareaRef.current?.setSelectionRange(cursor, cursor);
        });
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}
