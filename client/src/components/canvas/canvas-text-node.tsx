import { useLayoutEffect, useRef } from "react";
import type { Node, NodeProps } from "@xyflow/react";

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
  onCancel: (id: string) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelledRef = useRef(false);
  const font = CANVAS_TEXT_FONTS.find(
    (candidate) => candidate.value === data.object.font,
  )!;
  const size = CANVAS_TEXT_SIZES.find(
    (candidate) => candidate.value === data.object.size,
  )!;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(24, textarea.scrollHeight)}px`;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [data.editing, data.object.content, data.object.font, data.object.size]);

  const typographyClass = cn(
    font.className,
    size.className,
    data.object.font === "caveat"
      ? "font-medium tracking-[0.01em]"
      : "font-normal",
  );

  return (
    <div
      className={cn(
        "group/text relative min-h-7 w-[22.5rem] rounded-sm px-1 py-0.5",
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
      {data.editing ? (
        <textarea
          ref={textareaRef}
          className={cn(
            "nodrag nowheel block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-current/35",
            typographyClass,
          )}
          defaultValue={data.object.content}
          placeholder="Type something…"
          maxLength={2_000}
          aria-label="Canvas text"
          onInput={(event) => {
            event.currentTarget.style.height = "0px";
            event.currentTarget.style.height = `${Math.max(24, event.currentTarget.scrollHeight)}px`;
          }}
          onBlur={(event) => {
            if (cancelledRef.current) {
              cancelledRef.current = false;
              return;
            }
            data.onCommit(data.object.id, event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelledRef.current = true;
              data.onCancel(data.object.id);
              event.currentTarget.blur();
            } else if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey)
            ) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      ) : (
        <p className={cn("whitespace-pre-wrap break-words", typographyClass)}>
          {data.object.content}
        </p>
      )}

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
        </div>
      ) : null}
    </div>
  );
}
