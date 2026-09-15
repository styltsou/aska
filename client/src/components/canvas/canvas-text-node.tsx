import { useLayoutEffect, useRef, useState } from "react";
import type { Node, NodeProps, XYPosition } from "@xyflow/react";
import { Trash2Icon } from "lucide-react";

import type {
  CanvasObjectColor,
  CanvasTextFont,
  CanvasTextObject,
  CanvasTextSize,
} from "@/api/collection";
import { cn } from "@/lib/utils";
import {
  CANVAS_OBJECT_COLORS,
  CANVAS_TEXT_FONTS,
  CANVAS_TEXT_SIZES,
  canvasObjectColor,
} from "./canvas-object-style";

export type CanvasTextNodeData = {
  object: CanvasTextObject;
  editing: boolean;
  onSelect: (id: string, event: React.MouseEvent) => void;
  onBeginEdit: (id: string) => void;
  onCommit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onStyle: (
    id: string,
    update: Partial<Pick<CanvasTextObject, "font" | "size" | "color">>,
  ) => void;
};

export type CanvasTextFlowNode = Node<CanvasTextNodeData, "text">;

export function CanvasTextNode({
  data,
  selected,
}: NodeProps<CanvasTextFlowNode>) {
  const font = CANVAS_TEXT_FONTS.find(
    (candidate) => candidate.value === data.object.font,
  )!;
  const size = CANVAS_TEXT_SIZES.find(
    (candidate) => candidate.value === data.object.size,
  )!;

  const typographyClass = cn(
    font.className,
    size.className,
    data.object.font === "sue_ellen_francisco"
      ? "font-normal leading-[1.3] tracking-[0.01em]"
      : data.object.font === "fraunces"
        ? "font-normal tracking-[-0.01em]"
        : data.object.font === "ibm_plex_mono"
          ? "font-normal tracking-[-0.02em]"
          : "font-normal",
  );

  return (
    <div
      className={cn(
        "group/text relative inline-block min-h-7 rounded-sm px-1 py-0.5",
        selected && "outline-1 outline-primary/70 outline-offset-4",
      )}
      style={{ color: canvasObjectColor(data.object.color) }}
      data-selection-node-id={data.object.id}
      onClick={(event) => data.onSelect(data.object.id, event)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        data.onBeginEdit(data.object.id);
      }}
    >
      {!data.editing ? (
        <p className={cn("whitespace-pre", typographyClass)}>
          {data.object.content}
        </p>
      ) : null}

      {selected ? (
        <div
          role="toolbar"
          aria-label="Text style"
          className="nodrag nowheel absolute bottom-[calc(100%+10px)] left-0 z-20 flex items-center gap-1 rounded-lg border border-border/70 bg-popover/95 p-1 text-popover-foreground shadow-lg backdrop-blur"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {CANVAS_TEXT_FONTS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "h-7 rounded-md px-2 text-xs transition-colors hover:bg-accent",
                option.className,
                data.object.font === option.value && "bg-accent",
              )}
              aria-pressed={data.object.font === option.value}
              onClick={() =>
                data.onStyle(data.object.id, {
                  font: option.value as CanvasTextFont,
                })
              }
            >
              {option.label}
            </button>
          ))}
          <span className="mx-0.5 h-5 w-px bg-border" />
          {CANVAS_TEXT_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                "size-7 rounded-md text-[11px] font-medium transition-colors hover:bg-accent",
                data.object.size === option.value && "bg-accent",
              )}
              aria-label={`${option.label} text size`}
              aria-pressed={data.object.size === option.value}
              onClick={() =>
                data.onStyle(data.object.id, {
                  size: option.value as CanvasTextSize,
                })
              }
            >
              {option.label}
            </button>
          ))}
          <span className="mx-0.5 h-5 w-px bg-border" />
          {CANVAS_OBJECT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cn(
                "size-5 rounded-full border border-black/10 ring-offset-2 ring-offset-popover",
                data.object.color === color && "ring-2 ring-ring",
              )}
              style={{ backgroundColor: canvasObjectColor(color) }}
              aria-label={`${color} text color`}
              aria-pressed={data.object.color === color}
              onClick={() =>
                data.onStyle(data.object.id, {
                  color: color as CanvasObjectColor,
                })
              }
            />
          ))}
          <span className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete text"
            onClick={() => data.onDelete(data.object.id)}
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
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
  const font = CANVAS_TEXT_FONTS.find(
    (candidate) => candidate.value === object.font,
  )!;
  const size = CANVAS_TEXT_SIZES.find(
    (candidate) => candidate.value === object.size,
  )!;
  const typographyClass = cn(
    font.className,
    size.className,
    object.font === "sue_ellen_francisco"
      ? "font-normal leading-[1.3] tracking-[0.01em]"
      : object.font === "fraunces"
        ? "font-normal tracking-[-0.01em]"
        : object.font === "ibm_plex_mono"
          ? "font-normal tracking-[-0.02em]"
          : "font-normal",
  );

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
        "nodrag nopan nowheel field-sizing-content absolute z-20 block min-w-6 max-w-none resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-none placeholder:text-current/35",
        typographyClass,
      )}
      style={{
        left: position.x + 4,
        top: position.y + 2,
        color: canvasObjectColor(object.color),
        pointerEvents: "all",
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
