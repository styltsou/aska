import { headingIconForLevel } from "../blocks/note-heading-icon";
import { type Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  BoldIcon,
  CaseSensitiveIcon,
  CheckSquareIcon,
  CodeIcon,
  EraserIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PackagePlusIcon,
  QuoteIcon,
  SparklesIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  blockStyleLabel,
  resolveBlockStyle,
  type BlockStyleValue,
} from "@/components/board/note-editor/blocks/note-block-style";
import { NoteSelectionMenuSurface } from "@/components/board/note-editor/formatting/note-selection-actions";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GLASS_ISLAND_CLASS } from "@/lib/glass";
import { markdownFromSelection } from "@/lib/markdown";
import { cn } from "@/lib/utils";

import {
  NOTE_HIGHLIGHT_COLORS,
  type NoteHighlightColor,
} from "@/lib/note-highlights";

import {
  hasHighlightInSelection,
  replaceHighlight,
} from "../highlight/note-highlight-selection";
const BLOCK_STYLE_ICONS: Record<BlockStyleValue, typeof CaseSensitiveIcon> = {
  "task-list": CheckSquareIcon,
  "ordered-list": ListOrderedIcon,
  "bullet-list": ListIcon,
  "heading-1": Heading1Icon,
  "heading-2": Heading2Icon,
  "heading-3": Heading3Icon,
  "heading-4": Heading4Icon,
  paragraph: CaseSensitiveIcon,
};

function blockStylePresentation(value: BlockStyleValue) {
  return { label: blockStyleLabel(value), Icon: BLOCK_STYLE_ICONS[value] };
}

function applyBlockStyle(editor: Editor, value: BlockStyleValue) {
  switch (value) {
    case "paragraph":
      editor.chain().focus().setParagraph().run();
      return;
    case "heading-1":
      editor.chain().focus().setNode("heading", { level: 1 }).run();
      return;
    case "heading-2":
      editor.chain().focus().setNode("heading", { level: 2 }).run();
      return;
    case "heading-3":
      editor.chain().focus().setNode("heading", { level: 3 }).run();
      return;
    case "heading-4":
      editor.chain().focus().setNode("heading", { level: 4 }).run();
      return;
    case "bullet-list":
      editor.chain().focus().toggleBulletList().run();
      return;
    case "ordered-list":
      editor.chain().focus().toggleOrderedList().run();
      return;
    case "task-list":
      editor.chain().focus().toggleTaskList().run();
  }
}

export function InlineFormattingMenu({
  editor,
  onExtractSelection,
  onAskAgent,
  blockStyleMenuOpen,
  onBlockStyleMenuOpenChange,
  menuRef,
}: {
  editor: Editor;
  onExtractSelection?: (content: string) => void;
  onAskAgent?: () => void;
  blockStyleMenuOpen: boolean;
  onBlockStyleMenuOpenChange: (open: boolean) => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [highlightPaletteOpen, setHighlightPaletteOpen] = useState(false);
  const [selectionCopied, setSelectionCopied] = useState(false);
  const [href, setHref] = useState("");
  const active = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      code: currentEditor.isActive("code"),
      link: currentEditor.isActive("link"),
      strike: currentEditor.isActive("strike"),
      underline: currentEditor.isActive("underline"),
      blockquote: currentEditor.isActive("blockquote"),
      block: resolveBlockStyle(currentEditor.state.selection),
      highlight: hasHighlightInSelection(currentEditor),
    }),
  }) ?? {
    bold: false,
    italic: false,
    code: false,
    link: false,
    strike: false,
    underline: false,
    blockquote: false,
    block: "paragraph" as BlockStyleValue,
    highlight: false,
  };

  function toggleLinkInput() {
    setHref(editor.getAttributes("link").href ?? "");
    setLinkOpen((open) => !open);
  }

  function applySelectionHighlight(color: NoteHighlightColor) {
    replaceHighlight(editor, color);
    setHighlightPaletteOpen(false);
  }

  function applyLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = href.trim();
    const selectionEnd = editor.state.selection.to;
    if (!url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .unsetLink()
        .setTextSelection(selectionEnd)
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .setTextSelection(selectionEnd)
        .run();
    }
    setLinkOpen(false);
  }

  useEffect(() => {
    if (!linkOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;

      // Let the pointer event continue to its target. In particular, another
      // open editor must be able to establish its own focus and selection.
      setLinkOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [linkOpen, menuRef]);

  useEffect(() => {
    if (!selectionCopied) return;
    const timeout = window.setTimeout(() => setSelectionCopied(false), 1_600);
    return () => window.clearTimeout(timeout);
  }, [selectionCopied]);

  if (linkOpen) {
    return (
      <div ref={menuRef}>
        <form
          className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-xl backdrop-blur-xl"
          onSubmit={applyLink}
        >
          <input
            // Deliberate: focus the field as soon as this opens.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="h-8 w-56 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Paste or type a link"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setLinkOpen(false);
                editor.commands.focus();
              }
            }}
          />
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </div>
    );
  }

  const controls = [
    {
      label: "Bold",
      icon: BoldIcon,
      active: active?.bold ?? false,
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: ItalicIcon,
      active: active?.italic ?? false,
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      icon: UnderlineIcon,
      active: active?.underline ?? false,
      action: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Strikethrough",
      icon: StrikethroughIcon,
      active: active?.strike ?? false,
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "Link",
      icon: LinkIcon,
      active: active?.link ?? false,
      action: toggleLinkInput,
    },
    {
      label: "Blockquote",
      icon: QuoteIcon,
      active: active?.blockquote ?? false,
      action: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: "Inline code",
      icon: CodeIcon,
      active: active?.code ?? false,
      action: () => editor.chain().focus().toggleCode().run(),
    },
  ];

  function extractSelection() {
    if (!onExtractSelection) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0)
      return;
    const content = markdownFromSelection(
      selection.getRangeAt(0),
      selection,
    ).trim();
    if (content) onExtractSelection(content);
  }

  async function copySelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const text = selection.toString();
    if (!text) return;

    const container = document.createElement("div");
    container.appendChild(selection.getRangeAt(0).cloneContents());

    try {
      if (
        typeof ClipboardItem !== "undefined" &&
        typeof navigator.clipboard?.write === "function"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([container.innerHTML], {
              type: "text/html",
            }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else if (typeof navigator.clipboard?.writeText === "function") {
        await navigator.clipboard.writeText(text);
      } else {
        toast.error("Clipboard is not available.");
        return;
      }

      setSelectionCopied(true);
      toast.success("Copied selection.");
    } catch {
      toast.error("Unable to copy selection.");
    }
  }

  const currentBlock = blockStylePresentation(active.block);
  const BlockIcon = currentBlock.Icon;

  return (
    <div ref={menuRef} data-note-bubble-menu="">
      <Select
        value={active.block}
        open={blockStyleMenuOpen}
        onOpenChange={onBlockStyleMenuOpenChange}
        modal={false}
        onValueChange={(value) => {
          if (!value) return;
          applyBlockStyle(editor, value as BlockStyleValue);
        }}
      >
        <NoteSelectionMenuSurface>
          {onAskAgent ? (
            <div className={GLASS_ISLAND_CLASS}>
              <ButtonGroup>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 rounded-md px-1.5 text-xs font-medium text-foreground hover:bg-foreground/5 hover:text-foreground"
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={onAskAgent}
                      >
                        <SparklesIcon className="size-3.5" />
                        Ask AI
                      </Button>
                    }
                  />
                  <TooltipContent>Edit the selection with AI</TooltipContent>
                </Tooltip>
              </ButtonGroup>
            </div>
          ) : null}
          <div className={GLASS_ISLAND_CLASS}>
            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <SelectTrigger
                      size="sm"
                      className="h-7 gap-1 rounded-md border-0 bg-transparent px-1.5 text-xs font-medium text-foreground hover:bg-foreground/5 aria-expanded:bg-foreground/5 aria-expanded:text-foreground dark:bg-transparent dark:hover:bg-secondary/50 dark:aria-expanded:bg-secondary/50"
                      aria-label="Text style"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      <BlockIcon className="size-3.5" />
                      <SelectValue>{currentBlock.label}</SelectValue>
                    </SelectTrigger>
                  }
                />
                <TooltipContent>Text style</TooltipContent>
              </Tooltip>
            </ButtonGroup>
          </div>
          <div className={GLASS_ISLAND_CLASS}>
            <ButtonGroup>
              {controls.map((control) => {
                const Icon = control.icon;
                return (
                  <Tooltip key={control.label}>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={cn(
                            "rounded-md text-foreground hover:bg-foreground/5 hover:text-foreground",
                            control.active &&
                              "bg-foreground/10 text-foreground",
                          )}
                          type="button"
                          aria-label={control.label}
                          aria-pressed={control.active}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={control.action}
                        >
                          <Icon className="size-3.5" />
                        </Button>
                      }
                    />
                    <TooltipContent>{control.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </ButtonGroup>
          </div>
          <div className={GLASS_ISLAND_CLASS}>
            <ButtonGroup>
              <Popover
                open={highlightPaletteOpen}
                onOpenChange={setHighlightPaletteOpen}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-md text-foreground hover:bg-foreground/5 hover:text-foreground data-popup-open:bg-foreground/5 data-popup-open:text-foreground"
                            type="button"
                            aria-label="Highlight selection"
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            <HighlighterIcon className="size-3.5" />
                          </Button>
                        }
                      />
                    }
                  />
                  <TooltipContent>Highlight selection</TooltipContent>
                </Tooltip>
                <PopoverContent
                  align="start"
                  side="top"
                  sideOffset={8}
                  initialFocus={false}
                  surface="solid"
                  className="w-fit gap-1 rounded-xl p-1.5"
                >
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label="Highlight color"
                  >
                    {NOTE_HIGHLIGHT_COLORS.map((color) => (
                      <Tooltip key={color.value}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              aria-label={`Highlight with ${color.label}`}
                              className="size-6 rounded-md border border-transparent transition-[filter,box-shadow] duration-100 hover:ring-1 hover:ring-foreground/20 hover:brightness-95 hover:ring-inset focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:hover:brightness-110"
                              style={{
                                backgroundColor: `var(--note-highlight-${color.value})`,
                              }}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() =>
                                applySelectionHighlight(color.value)
                              }
                            />
                          }
                        />
                        <TooltipContent>{color.label}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <AnimatePresence initial={false}>
                {active.highlight ? (
                  <motion.div
                    key="remove-highlight"
                    data-slot="button"
                    initial={{ opacity: 0, width: 0, x: -4 }}
                    animate={{ opacity: 1, width: 28, x: 0 }}
                    exit={{ opacity: 0, width: 0, x: -4 }}
                    transition={{ duration: 0.1, ease: [0, 0, 0.2, 1] }}
                    className="flex overflow-hidden"
                  >
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-l-none rounded-r-md text-foreground hover:bg-foreground/5 hover:text-foreground"
                            aria-label="Remove highlight"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() =>
                              editor.chain().focus().unsetHighlight().run()
                            }
                          >
                            <EraserIcon className="size-3.5" />
                          </Button>
                        }
                      />
                      <TooltipContent>Remove highlight</TooltipContent>
                    </Tooltip>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </ButtonGroup>
          </div>
          <div className={GLASS_ISLAND_CLASS}>
            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-md text-foreground hover:bg-foreground/5 hover:text-foreground"
                      type="button"
                      aria-label={
                        selectionCopied ? "Selection copied" : "Copy selection"
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => void copySelection()}
                    >
                      <CopyFeedbackIcon
                        copied={selectionCopied}
                        className="size-3.5"
                      />
                    </Button>
                  }
                />
                <TooltipContent>
                  {selectionCopied ? "Copied" : "Copy selection"}
                </TooltipContent>
              </Tooltip>
            </ButtonGroup>
          </div>
          {onExtractSelection ? (
            <div className={GLASS_ISLAND_CLASS}>
              <ButtonGroup>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-md text-foreground hover:bg-foreground/5 hover:text-foreground"
                        type="button"
                        aria-label="Extract note"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={extractSelection}
                      >
                        <PackagePlusIcon className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent>Extract note</TooltipContent>
                </Tooltip>
              </ButtonGroup>
            </div>
          ) : null}
        </NoteSelectionMenuSurface>
        <SelectContent
          align="start"
          side="top"
          sideOffset={8}
          alignItemWithTrigger={false}
          surface="solid"
          className="w-44 min-w-max p-1"
        >
          <SelectItem value="paragraph">
            <CaseSensitiveIcon className="size-4" />
            <span>Text</span>
          </SelectItem>
          {[1, 2, 3, 4].map((level) => {
            const HeadingIcon = headingIconForLevel(level);
            return (
              <SelectItem key={level} value={`heading-${level}`}>
                <HeadingIcon className="size-4" />
                <span>Heading {level}</span>
              </SelectItem>
            );
          })}
          <SelectSeparator />
          <SelectItem value="bullet-list">
            <ListIcon className="size-4" />
            <span>Bullet list</span>
          </SelectItem>
          <SelectItem value="ordered-list">
            <ListOrderedIcon className="size-4" />
            <span>Numbered list</span>
          </SelectItem>
          <SelectItem value="task-list">
            <CheckSquareIcon className="size-4" />
            <span>To-do list</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
