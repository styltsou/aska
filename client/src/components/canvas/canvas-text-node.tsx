import { useLayoutEffect, useRef, useState } from "react";
import { type Node, type NodeProps, type XYPosition } from "@xyflow/react";
import { AnimatePresence } from "motion/react";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";

import type {
  CanvasTextFont,
  CanvasTextObject,
  CanvasTextSize,
} from "@/api/collection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GLASS_OPTION_TOOLBAR_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useTransientStore } from "@/store";
import {
  CANVAS_TEXT_FONTS,
  CANVAS_TEXT_SIZES,
  canvasObjectColor,
  canvasTextFontPreviewStyle,
  canvasTextTypography,
} from "./canvas-object-style";
import { CanvasColorSwatches } from "./canvas-color-swatches";
import { OVERLAY_Z_INDEX } from "./canvas-node-stacking";
import { CanvasScreenOverlay } from "./canvas-screen-overlay";

export type CanvasTextNodeData = {
  object: CanvasTextObject;
  boardKey: string;
  editing: boolean;
  focused: boolean;
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
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<CanvasTextFlowNode>) {
  const viewportActivity = useTransientStore(
    (state) => state.canvasViewportActivity[data.boardKey] ?? 0,
  );
  const font = CANVAS_TEXT_FONTS.find(
    (candidate) => candidate.value === data.object.font,
  )!;
  const typography = canvasTextTypography(data.object.font, data.object.size);

  return (
    <div
      className={cn(
        "group/text relative inline-block min-h-7 rounded-sm px-2 py-1.5",
        selected
          ? "ring-2 ring-primary"
          : !data.editing &&
              "outline-1 outline-transparent transition-[outline-color] duration-100 ease-[cubic-bezier(0.16,1,0.3,1)] hover:outline-current/25",
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
        <p
          className={cn("whitespace-pre", typography.className)}
          style={typography.style}
        >
          {data.object.content}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {data.focused ? (
          <CanvasScreenOverlay
            anchor={{ x: positionAbsoluteX, y: positionAbsoluteY }}
          >
            <div
              role="toolbar"
              aria-label="Text style"
              className="flex items-center gap-2"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <div
                className={cn(
                  "flex items-center gap-0.5 rounded-lg px-1.5 py-1",
                  GLASS_OPTION_TOOLBAR_CLASS,
                )}
              >
                <DropdownMenu key={viewportActivity}>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className={cn(
                          "flex h-7 items-center gap-1 rounded-md px-1.5 text-xs transition-colors hover:bg-foreground/5 aria-expanded:bg-foreground/10",
                        )}
                      />
                    }
                    aria-label="Text font"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <span
                      className={cn(
                        font.className,
                        font.value === "sue_ellen_francisco" && "mr-px",
                      )}
                      style={canvasTextFontPreviewStyle(font.value, 12)}
                    >
                      {font.label}
                    </span>
                    <ChevronDownIcon className="size-3 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    className="w-32 min-w-32 overflow-visible rounded-lg p-1"
                  >
                    <DropdownMenuRadioGroup
                      value={data.object.font}
                      onValueChange={(value) =>
                        data.onStyle(data.object.id, {
                          font: value as CanvasTextFont,
                        })
                      }
                    >
                      {CANVAS_TEXT_FONTS.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.value}
                          value={option.value}
                          className="h-8 py-0"
                        >
                          <span
                            className={option.className}
                            style={canvasTextFontPreviewStyle(option.value, 14)}
                          >
                            {option.label}
                          </span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="mx-0.5 h-5 w-px bg-border" />
                {CANVAS_TEXT_SIZES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "size-7 rounded-md text-[11px] font-medium transition-colors hover:bg-foreground/5",
                      data.object.size === option.value && "bg-foreground/10",
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
                <CanvasColorSwatches
                  value={data.object.color}
                  dismissKey={viewportActivity}
                  onChange={(color) =>
                    data.onStyle(data.object.id, {
                      color,
                    })
                  }
                  ariaLabel="Text color"
                />
              </div>
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg p-1",
                  GLASS_OPTION_TOOLBAR_CLASS,
                )}
              >
                <button
                  type="button"
                  className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete text"
                  onClick={() => data.onDelete(data.object.id)}
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            </div>
          </CanvasScreenOverlay>
        ) : null}
      </AnimatePresence>
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
