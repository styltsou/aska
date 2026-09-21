import { ChevronDownIcon, Trash2Icon } from "lucide-react";

import type {
  CanvasArrowHead,
  CanvasArrowObject,
  CanvasArrowPattern,
  CanvasArrowRouting,
  CanvasArrowStyle,
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
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  FLOATING_GLASS_BACKDROP_CLASS,
  GLASS_FRAME_CLASS,
  GLASS_ISLAND_CLASS,
} from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useTransientStore } from "@/store";
import { CanvasColorSwatches } from "./canvas-color-swatches";
import {
  CANVAS_TEXT_FONTS,
  CANVAS_TEXT_SIZES,
  canvasTextFontPreviewStyle,
} from "./canvas-object-style";

type ArrowUpdate = Partial<
  Pick<CanvasArrowObject, "style" | "pattern" | "head" | "routing" | "color">
>;
type TextUpdate = Partial<Pick<CanvasTextObject, "font" | "size" | "color">>;

const INSPECTOR_HINT_KBD_CLASS = "h-4 min-w-fit px-1 text-[10px]";

export type CanvasInspectorTarget =
  | {
      type: "arrow";
      object: CanvasArrowObject;
      pointEditing: boolean;
      onUpdate: (id: string, update: ArrowUpdate) => void;
      onDelete: (id: string) => void;
    }
  | {
      type: "text";
      object: CanvasTextObject;
      onUpdate: (id: string, update: TextUpdate) => void;
      onDelete: (id: string) => void;
    };

export function CanvasObjectInspector({
  boardKey,
  target,
  modifierLabel,
}: {
  boardKey: string;
  target?: CanvasInspectorTarget;
  modifierLabel: string;
}) {
  const viewportActivity = useTransientStore(
    (state) => state.canvasViewportActivity[boardKey] ?? 0,
  );
  if (!target) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${target.type === "arrow" ? "Arrow" : "Text"} style`}
      className="pointer-events-auto flex w-fit flex-col items-start gap-1"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className={cn("relative w-fit", FLOATING_GLASS_BACKDROP_CLASS)}>
        <div
          className={cn(
            "relative z-10 flex flex-col items-stretch gap-1 rounded-lg p-1",
            GLASS_FRAME_CLASS,
          )}
        >
          <div className="flex items-center gap-1">
            <div
              className={cn(
                GLASS_ISLAND_CLASS,
                "flex items-center gap-0.5 px-1.5 py-1",
              )}
            >
              {target.type === "arrow" ? (
                <ArrowControls
                  arrow={target.object}
                  dismissKey={viewportActivity}
                  onUpdate={target.onUpdate}
                />
              ) : (
                <TextControls
                  text={target.object}
                  dismissKey={viewportActivity}
                  onUpdate={target.onUpdate}
                />
              )}
            </div>
            <div
              className={cn(
                GLASS_ISLAND_CLASS,
                "flex size-9 items-center justify-center p-1",
              )}
            >
              <button
                type="button"
                className="flex size-7 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${target.type}`}
                onClick={() => target.onDelete(target.object.id)}
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          </div>
          {target.type === "arrow" ? (
            <div className="flex min-h-6 items-center px-1.5 pb-0.5">
              <ArrowInspectorHint
                pointEditing={target.pointEditing}
                modifierLabel={modifierLabel}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ArrowControls({
  arrow,
  dismissKey,
  onUpdate,
}: {
  arrow: CanvasArrowObject;
  dismissKey: number;
  onUpdate: (id: string, update: ArrowUpdate) => void;
}) {
  return (
    <>
      <DropdownMenu key={`pattern-${dismissKey}`}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-md px-2 text-xs capitalize transition-colors hover:bg-foreground/5 data-popup-open:bg-foreground/10"
            />
          }
          aria-label="Arrow line type"
        >
          {arrow.pattern}
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="min-w-28"
        >
          <DropdownMenuRadioGroup
            value={arrow.pattern}
            onValueChange={(value) =>
              onUpdate(arrow.id, { pattern: value as CanvasArrowPattern })
            }
          >
            {(["solid", "dashed", "dotted"] as CanvasArrowPattern[]).map(
              (pattern) => (
                <DropdownMenuRadioItem
                  key={pattern}
                  value={pattern}
                  className="capitalize"
                >
                  {pattern}
                </DropdownMenuRadioItem>
              ),
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarDivider />
      {(["clean", "sketch"] as CanvasArrowStyle[]).map((style) => (
        <button
          key={style}
          type="button"
          className={cn(
            "h-7 cursor-pointer rounded-md px-2 text-xs capitalize hover:bg-foreground/5",
            arrow.style === style && "bg-foreground/10",
          )}
          aria-pressed={arrow.style === style}
          onClick={() => onUpdate(arrow.id, { style })}
        >
          {style}
        </button>
      ))}
      <ToolbarDivider />
      {(["straight", "smooth"] as CanvasArrowRouting[]).map((routing) => (
        <button
          key={routing}
          type="button"
          className={cn(
            "h-7 cursor-pointer rounded-md px-2 text-xs hover:bg-foreground/5",
            arrow.routing === routing && "bg-foreground/10",
          )}
          aria-label={`${routing} arrow path`}
          aria-pressed={arrow.routing === routing}
          onClick={() => onUpdate(arrow.id, { routing })}
        >
          {routing === "straight" ? "Line" : "Curve"}
        </button>
      ))}
      <ToolbarDivider />
      <DropdownMenu key={`head-${dismissKey}`}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-foreground/5 data-popup-open:bg-foreground/10"
            />
          }
          aria-label={`${arrow.head} arrowhead`}
        >
          <ArrowheadGlyph head={arrow.head} style={arrow.style} />
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="min-w-36"
        >
          <DropdownMenuRadioGroup
            value={arrow.head}
            onValueChange={(value) =>
              onUpdate(arrow.id, { head: value as CanvasArrowHead })
            }
          >
            {(["filled", "hollow", "chevron"] as CanvasArrowHead[]).map(
              (head) => (
                <DropdownMenuRadioItem
                  key={head}
                  value={head}
                  className="capitalize"
                >
                  <ArrowheadGlyph head={head} style={arrow.style} />
                  {head}
                </DropdownMenuRadioItem>
              ),
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarDivider />
      <CanvasColorSwatches
        value={arrow.color}
        onChange={(color) => onUpdate(arrow.id, { color })}
        ariaLabel="Arrow color"
        dismissKey={dismissKey}
      />
    </>
  );
}

function TextControls({
  text,
  dismissKey,
  onUpdate,
}: {
  text: CanvasTextObject;
  dismissKey: number;
  onUpdate: (id: string, update: TextUpdate) => void;
}) {
  const font = CANVAS_TEXT_FONTS.find(
    (candidate) => candidate.value === text.font,
  )!;
  return (
    <>
      <DropdownMenu key={`font-${dismissKey}`}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-xs transition-colors hover:bg-foreground/5 aria-expanded:bg-foreground/10"
            />
          }
          aria-label="Text font"
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
            value={text.font}
            onValueChange={(value) =>
              onUpdate(text.id, { font: value as CanvasTextFont })
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
      <ToolbarDivider />
      {CANVAS_TEXT_SIZES.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "size-7 rounded-md text-[11px] font-medium transition-colors hover:bg-foreground/5",
            text.size === option.value && "bg-foreground/10",
          )}
          aria-label={`${option.label} text size`}
          aria-pressed={text.size === option.value}
          onClick={() =>
            onUpdate(text.id, { size: option.value as CanvasTextSize })
          }
        >
          {option.label}
        </button>
      ))}
      <ToolbarDivider />
      <CanvasColorSwatches
        value={text.color}
        dismissKey={dismissKey}
        onChange={(color) => onUpdate(text.id, { color })}
        ariaLabel="Text color"
      />
    </>
  );
}

function ArrowInspectorHint({
  pointEditing,
  modifierLabel,
}: {
  pointEditing: boolean;
  modifierLabel: string;
}) {
  return (
    <div className="pointer-events-none flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-4 text-muted-foreground select-none">
      {pointEditing ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <KbdGroup className="gap-0.5">
            <Kbd variant="solid" className={INSPECTOR_HINT_KBD_CLASS}>
              {modifierLabel}
            </Kbd>
            <span>+</span>
            <span>click</span>
          </KbdGroup>
          <span>a point to remove it</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <KbdGroup className="gap-0.5">
            <Kbd variant="solid" className={INSPECTOR_HINT_KBD_CLASS}>
              {modifierLabel}
            </Kbd>
            <span>+</span>
            <span>double-click</span>
          </KbdGroup>
          <span>or</span>
          <KbdGroup className="gap-0.5">
            <Kbd variant="solid" className={INSPECTOR_HINT_KBD_CLASS}>
              {modifierLabel}
            </Kbd>
            <span>+</span>
            <Kbd variant="solid" className={INSPECTOR_HINT_KBD_CLASS}>
              Enter
            </Kbd>
          </KbdGroup>
          <span>to edit points</span>
        </span>
      )}
    </div>
  );
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-border" />;
}

function ArrowheadGlyph({
  head,
  style,
}: {
  head: CanvasArrowHead;
  style: CanvasArrowStyle;
}) {
  if (style === "sketch") {
    return (
      <svg viewBox="0 0 30 18" className="h-4 w-7" aria-hidden="true">
        <path
          d="M 1.5 9.4 Q 10 7.4 21 8.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M 2 8.1 Q 11 10.1 21.3 8.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />
        {head === "filled" ? (
          <>
            <path d="M 20.2 2.1 L 29 8.6 L 19.4 15.4 z" fill="currentColor" />
            <path
              d="M 20.7 2.7 L 28.7 8.1 L 19.8 14.8 z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.9"
              strokeLinejoin="round"
              opacity="0.65"
            />
          </>
        ) : head === "hollow" ? (
          <>
            <path
              d="M 20.2 2.1 L 29 8.6 L 19.4 15.4 z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M 20.7 2.7 L 28.7 8.1 L 19.8 14.8 z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeLinejoin="round"
              opacity="0.6"
            />
          </>
        ) : (
          <>
            <path
              d="M 20.2 2.1 L 29 8.6 L 19.4 15.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 20.7 2.7 L 28.7 8.1 L 19.8 14.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.85"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
          </>
        )}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 30 18" className="h-4 w-7" aria-hidden="true">
      <path
        d="M 1.5 9 H 21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      {head === "filled" ? (
        <path d="M 20 2 L 29 9 L 20 16 z" fill="currentColor" />
      ) : head === "hollow" ? (
        <path
          d="M 20 2 L 29 9 L 20 16 z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M 20 2 L 29 9 L 20 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
