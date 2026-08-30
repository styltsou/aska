import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BoldIcon,
  BracesIcon,
  CaseSensitiveIcon,
  CheckSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  CopyIcon,
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
  MinusIcon,
  PackagePlusIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
} from "lucide-react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import {
  EditorContent,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type ReactNodeViewProps,
  ReactRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";

import { NotePreviewRail } from "@/components/board/note-preview-rail";
import {
  AssetMention,
  NoteMentionProvider,
  createMentionsExtension,
  parseNumericAssetId,
  type OpenNoteMentionTarget,
} from "@/components/board/note-mentions";
import { NoteSelectionMenuSurface } from "@/components/board/note-selection-actions";
import { AskaTaskItem } from "@/components/board/task-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";
import { markdownFromSelection } from "@/lib/markdown";
import { GLASS_ISLAND_CLASS } from "@/lib/glass";
import {
  isNoteHighlightColor,
  NOTE_HIGHLIGHT_COLORS,
  type NoteHighlightColor,
} from "@/lib/note-highlights";

export type NoteRichTextHandle = {
  getMarkdown: () => string;
  applyHighlight: (color: NoteHighlightColor) => string | undefined;
  removeHighlight: () => string | undefined;
  restoreMarkdown: (markdown: string) => void;
};

type SlashCommandItem = {
  title: string;
  description: string;
  keywords: string[];
  syntax?: string;
  icon: typeof CaseSensitiveIcon;
  command: (editor: Editor, range: Range) => void;
};

type SlashCommandGroup = {
  label: string;
  items: SlashCommandItem[];
};

const OPEN_LINK_EDITOR_EVENT = "aska:open-link-editor";
const noteLowlight = createLowlight(common);

function trailingEmptyParagraphPosition(editor: Editor): number | undefined {
  const { doc } = editor.state;
  const lastNode = doc.lastChild;
  if (lastNode?.type.name !== "paragraph" || lastNode.content.size !== 0) {
    return undefined;
  }
  return doc.content.size - lastNode.nodeSize + 1;
}

function focusFirstNewLine(editor: Editor) {
  let position = trailingEmptyParagraphPosition(editor);
  if (position === undefined) {
    editor
      .chain()
      .insertContentAt(
        docEnd(editor),
        { type: "paragraph" },
        {
          updateSelection: false,
        },
      )
      .command(({ tr }) => {
        // The paragraph only prepares the caret; it is not a user edit.
        tr.setMeta("preventUpdate", true);
        return true;
      })
      .run();
    position = trailingEmptyParagraphPosition(editor);
  }
  editor.commands.focus(position ?? "end", { scrollIntoView: false });
}

function hasHighlightInSelection(editor: Editor) {
  const { selection } = editor.state;
  if (selection.empty) return false;

  let hasHighlight = false;
  editor.state.doc.nodesBetween(selection.from, selection.to, (node) => {
    if (
      node.isText &&
      node.marks.some((mark) => mark.type.name === "highlight")
    ) {
      hasHighlight = true;
    }
    return !hasHighlight;
  });
  return hasHighlight;
}

function replaceHighlight(editor: Editor, color: NoteHighlightColor) {
  editor.chain().focus().unsetHighlight().setHighlight({ color }).run();
}

function docEnd(editor: Editor) {
  return editor.state.doc.content.size;
}

function headingDescription(level: number) {
  switch (level) {
    case 1:
      return "Big section heading.";
    case 2:
      return "Medium section heading.";
    case 3:
      return "Small section heading.";
    default:
      return "Smallest section heading.";
  }
}

function headingIconForLevel(level: number): typeof CaseSensitiveIcon {
  switch (level) {
    case 1:
      return Heading1Icon;
    case 2:
      return Heading2Icon;
    case 3:
      return Heading3Icon;
    default:
      return Heading4Icon;
  }
}

const SLASH_COMMAND_GROUPS: SlashCommandGroup[] = [
  {
    label: "Basic blocks",
    items: [
      {
        title: "Text",
        description: "Just start writing with plain text.",
        keywords: ["paragraph", "plain", "p", "body"],
        icon: CaseSensitiveIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).setParagraph().run(),
      },
      ...([1, 2, 3, 4] as const).map((level) => ({
        title: `Heading ${level}`,
        description: headingDescription(level),
        keywords: [`h${level}`, `heading${level}`],
        syntax: "#".repeat(level),
        icon: headingIconForLevel(level),
        command: (editor: Editor, range: Range) =>
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode("heading", { level })
            .run(),
      })),
    ],
  },
  {
    label: "Inline",
    items: [
      {
        title: "Link",
        description: "Add a link to selected link text.",
        keywords: ["url", "hyperlink", "anchor"],
        icon: LinkIcon,
        command: (editor, range) => {
          const linkText = "Link";
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(linkText)
            .setTextSelection({
              from: range.from,
              to: range.from + linkText.length,
            })
            .run();
          editor.view.dom.dispatchEvent(
            new CustomEvent(OPEN_LINK_EDITOR_EVENT),
          );
        },
      },
    ],
  },
  {
    label: "Lists",
    items: [
      {
        title: "Bullet list",
        description: "Create a simple bulleted list.",
        keywords: ["ul", "unordered", "bullets"],
        syntax: "-",
        icon: ListIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleBulletList().run(),
      },
      {
        title: "Numbered list",
        description: "Create a list with numbering.",
        keywords: ["ol", "ordered", "number"],
        syntax: "1.",
        icon: ListOrderedIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
      },
      {
        title: "To-do list",
        description: "Track tasks with checkboxes.",
        keywords: ["todo", "task", "checklist", "checkbox", "check"],
        syntax: "- [ ]",
        icon: CheckSquareIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleTaskList().run(),
      },
    ],
  },
  {
    label: "Advanced",
    items: [
      {
        title: "Quote",
        description: "Capture a quote or callout.",
        keywords: ["blockquote", "citation"],
        syntax: ">",
        icon: QuoteIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
      },
      {
        title: "Code block",
        description: "Capture a code snippet.",
        keywords: ["codeblock", "snippet", "fence", "pre"],
        syntax: "```",
        icon: BracesIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
      },
      {
        title: "Divider",
        description: "Visually divide sections.",
        keywords: ["hr", "line", "separator", "rule"],
        syntax: "---",
        icon: MinusIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
      },
      {
        title: "Table",
        description: "Insert a table with a header row.",
        keywords: ["grid", "cells", "rows"],
        syntax: "| |",
        icon: TableIcon,
        command: (editor, range) =>
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
    ],
  },
];

function scoreSlashItem(item: SlashCommandItem, query: string): number {
  const title = item.title.toLowerCase();
  if (title.startsWith(query)) return 4;
  if (item.keywords.some((keyword) => keyword.startsWith(query))) return 3;
  if (
    title.includes(query) ||
    item.keywords.some((keyword) => keyword.includes(query))
  )
    return 2;
  if (item.description.toLowerCase().includes(query)) return 1;
  return -1;
}

function filterSlashGroups(query: string): SlashCommandGroup[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return SLASH_COMMAND_GROUPS;
  return SLASH_COMMAND_GROUPS.map((group) => ({
    label: group.label,
    items: group.items
      .map((item) => ({ item, score: scoreSlashItem(item, normalized) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item),
  })).filter((group) => group.items.length > 0);
}

type SlashMenuHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

const SlashMenu = forwardRef<
  SlashMenuHandle,
  SuggestionProps<SlashCommandGroup, SlashCommandItem>
>(function SlashMenu({ items, query, command }, ref) {
  const flatItems = useMemo(
    () => items.flatMap((group) => group.items),
    [items],
  );
  const groupStarts = useMemo(() => {
    const starts = new Map<string, number>();
    let count = 0;
    for (const group of items) {
      starts.set(group.label, count);
      count += group.items.length;
    }
    return starts;
  }, [items]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => setSelectedIndex(0), [flatItems]);

  useEffect(() => {
    itemRefs.current.get(selectedIndex)?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function select(index: number) {
    const item = flatItems[index];
    if (item) command(item);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((index) =>
          flatItems.length === 0
            ? 0
            : (index + flatItems.length - 1) % flatItems.length,
        );
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((index) =>
          flatItems.length === 0 ? 0 : (index + 1) % flatItems.length,
        );
        return true;
      }
      if (event.key === "Enter") {
        select(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (flatItems.length === 0) {
    return (
      <div className="w-64 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
        <p className="px-3 py-2.5 text-xs text-muted-foreground">
          No blocks match “{query}”
        </p>
      </div>
    );
  }

  return (
    <div className="w-64 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
      <div
        className="max-h-72 [scrollbar-width:none] overflow-y-auto p-1 [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Insert block"
      >
        {items.map((group) => {
          const groupStart = groupStarts.get(group.label) ?? 0;
          return (
            <div key={group.label}>
              <p className="px-2 pt-2.5 pb-1 text-xs font-medium text-muted-foreground first:pt-1">
                {group.label}
              </p>
              {group.items.map((item, itemIndex) => {
                const index = groupStart + itemIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    ref={(element) => {
                      if (element) itemRefs.current.set(index, element);
                      else itemRefs.current.delete(index);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      index === selectedIndex
                        ? "bg-accent"
                        : "hover:bg-accent/60",
                    )}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(index)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <Icon className="size-4 shrink-0 text-current" />
                    <span className="min-w-0 truncate font-medium">
                      {item.title}
                    </span>
                    {item.syntax ? (
                      <span
                        className={cn(
                          "ml-auto shrink-0 font-mono text-xs tracking-normal",
                          index === selectedIndex
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.syntax}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});

const SlashCommands = Extension.create({
  name: "slashCommands",
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandGroup, SlashCommandItem>({
        editor: this.editor,
        char: "/",
        items: ({ query }) => filterSlashGroups(query),
        command: ({ editor, range, props }) => props.command(editor, range),
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return !$from.parent.type.spec.code;
        },
        render: () => {
          let renderer:
            | ReactRenderer<
                SlashMenuHandle,
                SuggestionProps<SlashCommandGroup, SlashCommandItem>
              >
            | undefined;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props,
              });
              // Suggestions mount under document.body. Keep the menu above the
              // full-screen note workspace instead of behind its dialog layer.
              renderer.element.style.zIndex = "70";
              unmount = props.mount(renderer.element);
            },
            onUpdate: (props) => renderer?.updateProps(props),
            onKeyDown: (props) => renderer?.ref?.onKeyDown(props) ?? false,
            onExit: () => {
              unmount?.();
              renderer?.destroy();
              renderer = undefined;
              unmount = undefined;
            },
          };
        },
      }),
    ];
  },
});

const CODE_BLOCK_LANGUAGES = [
  { value: "", label: "Plain text" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "tsx", label: "TSX" },
  { value: "python", label: "Python" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "rust", label: "Rust" },
  { value: "go", label: "Go" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
  { value: "diff", label: "Diff" },
];

function NoteCodeBlock({ node, updateAttributes }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language =
    typeof node.attrs.language === "string" ? node.attrs.language : "";
  const languageLabel =
    CODE_BLOCK_LANGUAGES.find((option) => option.value === language)?.label ??
    "Plain text";

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <NodeViewWrapper className="note-code-block">
      <div className="note-code-block-header" contentEditable={false}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="note-code-block-language"
                aria-label="Code block language"
                onMouseDown={(event) => event.preventDefault()}
              >
                <span>{languageLabel}</span>
                <ChevronDownIcon className="size-3" />
              </button>
            }
          />
          <DropdownMenuContent align="start" sideOffset={6} className="w-40">
            {CODE_BLOCK_LANGUAGES.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() =>
                  updateAttributes({ language: option.value || null })
                }
              >
                <span>{option.label}</span>
                {option.value === language ? (
                  <CheckIcon className="ml-auto size-3.5" />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="note-code-block-copy"
                aria-label="Copy code"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (typeof navigator.clipboard?.writeText !== "function") {
                    return;
                  }
                  void navigator.clipboard
                    .writeText(node.textContent)
                    .then(() => setCopied(true));
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                <span className="sr-only">
                  {copied ? "Copied" : "Copy code"}
                </span>
              </Button>
            }
          />
          <TooltipContent>{copied ? "Copied" : "Copy code"}</TooltipContent>
        </Tooltip>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

export const NoteHighlight = Highlight.extend({
  inclusive: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-highlight-color") ??
          element.getAttribute("data-color"),
        renderHTML: (attributes: { color?: unknown }) =>
          isNoteHighlightColor(attributes.color)
            ? { "data-highlight-color": attributes.color }
            : {},
      },
    };
  },
  renderMarkdown: (node, helpers) => {
    const color = isNoteHighlightColor(node.attrs?.color)
      ? node.attrs.color
      : "amber";
    if (color === "amber") {
      return `==${helpers.renderChildren(node)}==`;
    }
    return `[highlight color="${color}"]${helpers.renderChildren(node)}[/highlight]`;
  },
  parseMarkdown: (token, helpers) => {
    const color = token.attributes?.color;
    return helpers.applyMark(
      "highlight",
      helpers.parseInline(token.tokens || []),
      isNoteHighlightColor(color) ? { color } : { color: "amber" },
    );
  },
  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: (source: string) => {
      const shortcodeIndex = source.indexOf("[highlight");
      const legacyIndex = source.indexOf("==");
      if (shortcodeIndex < 0) return legacyIndex;
      if (legacyIndex < 0) return shortcodeIndex;
      return Math.min(shortcodeIndex, legacyIndex);
    },
    tokenize(source, _tokens, lexer) {
      const shortcode =
        /^\[highlight\s+color="(amber|mint|sky|rose|lavender)"\]([^\n]*?)\[\/highlight\]/.exec(
          source,
        );
      if (shortcode) {
        return {
          type: "highlight",
          raw: shortcode[0],
          attributes: { color: shortcode[1] },
          tokens: lexer.inlineTokens(shortcode[2] ?? ""),
        };
      }

      const legacy = /^==(?!\s+==)([^=\n]+)==/.exec(source);
      if (!legacy) return undefined;

      return {
        type: "highlight",
        raw: legacy[0],
        attributes: { color: "amber" },
        tokens: lexer.inlineTokens(legacy[1] ?? ""),
      };
    },
  },
}).configure({
  multicolor: true,
  HTMLAttributes: { class: "note-highlight" },
});

const BASE_NOTE_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    underline: false,
    link: {
      autolink: true,
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    },
    codeBlock: false,
  }),
  CodeBlockLowlight.extend({
    addNodeView() {
      return ReactNodeViewRenderer(NoteCodeBlock);
    },
  }).configure({
    lowlight: noteLowlight,
    defaultLanguage: null,
  }),
  TableKit.configure({ table: { resizable: true } }),
  TaskList,
  AskaTaskItem.configure({ nested: true }),
  NoteHighlight,
  Placeholder.configure({
    // Notes can intentionally start with a blank paragraph. Only show the
    // prompt for the paragraph containing the caret so a blank first line
    // does not display a second placeholder while the editor is focused at
    // the end of the note.
    showOnlyCurrent: true,
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return `Heading ${node.attrs.level}`;
      }
      return "Type '/' for blocks or '@' for mentions…";
    },
  }),
  Markdown.configure({
    markedOptions: { gfm: true, breaks: false },
  }),
  SlashCommands,
];

type ActiveBlockStyle = {
  taskList: boolean;
  orderedList: boolean;
  bulletList: boolean;
  heading1: boolean;
  heading2: boolean;
  heading3: boolean;
  heading4: boolean;
};

type BlockStyleValue =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "bullet-list"
  | "ordered-list"
  | "task-list";

function currentBlockStyle(active: ActiveBlockStyle) {
  switch (true) {
    case active.taskList:
      return {
        value: "task-list" as const,
        label: "To-do list",
        Icon: CheckSquareIcon,
      };
    case active.orderedList:
      return {
        value: "ordered-list" as const,
        label: "Numbered list",
        Icon: ListOrderedIcon,
      };
    case active.bulletList:
      return {
        value: "bullet-list" as const,
        label: "Bullet list",
        Icon: ListIcon,
      };
    case active.heading1:
      return {
        value: "heading-1" as const,
        label: "Heading 1",
        Icon: Heading1Icon,
      };
    case active.heading2:
      return {
        value: "heading-2" as const,
        label: "Heading 2",
        Icon: Heading2Icon,
      };
    case active.heading3:
      return {
        value: "heading-3" as const,
        label: "Heading 3",
        Icon: Heading3Icon,
      };
    case active.heading4:
      return {
        value: "heading-4" as const,
        label: "Heading 4",
        Icon: Heading4Icon,
      };
    default:
      return {
        value: "paragraph" as const,
        label: "Text",
        Icon: CaseSensitiveIcon,
      };
  }
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

function InlineFormattingMenu({
  editor,
  onExtractSelection,
}: {
  editor: Editor;
  onExtractSelection?: (content: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [highlightPaletteOpen, setHighlightPaletteOpen] = useState(false);
  const [href, setHref] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const active = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      code: currentEditor.isActive("code"),
      link: currentEditor.isActive("link"),
      strike: currentEditor.isActive("strike"),
      underline: currentEditor.isActive("underline"),
      heading1: currentEditor.isActive("heading", { level: 1 }),
      heading2: currentEditor.isActive("heading", { level: 2 }),
      heading3: currentEditor.isActive("heading", { level: 3 }),
      heading4: currentEditor.isActive("heading", { level: 4 }),
      blockquote: currentEditor.isActive("blockquote"),
      bulletList: currentEditor.isActive("bulletList"),
      orderedList: currentEditor.isActive("orderedList"),
      taskList: currentEditor.isActive("taskList"),
      highlight: hasHighlightInSelection(currentEditor),
    }),
  }) ?? {
    bold: false,
    italic: false,
    code: false,
    link: false,
    strike: false,
    underline: false,
    heading1: false,
    heading2: false,
    heading3: false,
    heading4: false,
    blockquote: false,
    bulletList: false,
    orderedList: false,
    taskList: false,
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

  useEffect(() => {
    function openLinkEditor() {
      setHref(editor.getAttributes("link").href ?? "");
      setLinkOpen(true);
    }

    editor.view.dom.addEventListener(OPEN_LINK_EDITOR_EVENT, openLinkEditor);
    return () =>
      editor.view.dom.removeEventListener(
        OPEN_LINK_EDITOR_EVENT,
        openLinkEditor,
      );
  }, [editor]);

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
  }, [linkOpen]);

  if (linkOpen) {
    return (
      <div ref={menuRef}>
        <form
          className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-xl backdrop-blur-xl"
          onSubmit={applyLink}
        >
          <input
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

  const currentBlock = currentBlockStyle(active);
  const BlockIcon = currentBlock.Icon;

  return (
    <div ref={menuRef}>
      <Select
        value={currentBlock.value}
        modal={false}
        onValueChange={(value) => {
          if (!value) return;
          applyBlockStyle(editor, value as BlockStyleValue);
        }}
      >
        <NoteSelectionMenuSurface>
          <div className={GLASS_ISLAND_CLASS}>
            <ButtonGroup>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <SelectTrigger
                      size="sm"
                      className="h-7 gap-1 rounded-md border-0 bg-transparent px-1.5 text-xs font-medium text-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground"
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
                        <button
                          data-slot="button"
                          className={cn(
                            "flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-foreground",
                            control.active && "bg-accent text-foreground",
                          )}
                          type="button"
                          aria-label={control.label}
                          aria-pressed={control.active}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={control.action}
                        >
                          <Icon className="size-3.5" />
                        </button>
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
                          <button
                            data-slot="button"
                            className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground"
                            type="button"
                            aria-label="Highlight selection"
                            onMouseDown={(event) => event.preventDefault()}
                          >
                            <HighlighterIcon className="size-3.5" />
                          </button>
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
                  className="w-fit gap-1 rounded-xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur-xl"
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
                            className="size-7 rounded-l-none rounded-r-md text-foreground hover:bg-accent hover:text-foreground"
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
          {onExtractSelection ? (
            <div className={GLASS_ISLAND_CLASS}>
              <ButtonGroup>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        data-slot="button"
                        className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-foreground"
                        type="button"
                        aria-label="Extract note"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={extractSelection}
                      >
                        <PackagePlusIcon className="size-3.5" />
                      </button>
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
          className="w-44 min-w-max rounded-lg border-border/50 bg-background/95 p-1 shadow-xl backdrop-blur-xl"
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

export const NoteRichText = forwardRef<
  NoteRichTextHandle,
  {
    markdown: string;
    editable: boolean;
    autoFocus?: boolean;
    className?: string;
    scrollContainerRef?: RefObject<HTMLDivElement | null>;
    onChange?: (markdown: string) => void;
    onSaveShortcut?: () => void;
    onExtractSelection?: (content: string) => void;
    highlightColor?: NoteHighlightColor;
    highlightMode?: boolean;
    onHighlightModeChange?: (active: boolean) => void;
    onHighlightSelectionChange?: (hasHighlight: boolean) => void;
    workspaceSlug?: string;
    sourceNoteId?: string;
    onOpenMention?: OpenNoteMentionTarget;
  }
>(function NoteRichText(
  {
    markdown,
    editable,
    autoFocus,
    className,
    scrollContainerRef,
    onChange,
    onSaveShortcut,
    onExtractSelection,
    highlightColor,
    highlightMode = false,
    onHighlightModeChange,
    onHighlightSelectionChange,
    workspaceSlug,
    sourceNoteId,
    onOpenMention,
  },
  ref,
) {
  const onChangeRef = useRef(onChange);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const editableRef = useRef(editable);
  const highlightColorRef = useRef<NoteHighlightColor | undefined>(
    highlightColor,
  );
  const highlightModeRef = useRef(highlightMode);
  const onHighlightModeChangeRef = useRef(onHighlightModeChange);
  const onHighlightSelectionChangeRef = useRef(onHighlightSelectionChange);
  const highlightPointerDownRef = useRef(false);
  const editorInstanceRef = useRef<Editor | null>(null);
  const initialMarkdownRef = useRef(markdown);
  onChangeRef.current = onChange;
  onSaveShortcutRef.current = onSaveShortcut;
  editableRef.current = editable;
  highlightColorRef.current = highlightColor;
  highlightModeRef.current = highlightMode;
  onHighlightModeChangeRef.current = onHighlightModeChange;
  onHighlightSelectionChangeRef.current = onHighlightSelectionChange;
  const sourceAssetId = parseNumericAssetId(sourceNoteId);
  const noteExtensions = useMemo(
    () => [
      ...BASE_NOTE_EXTENSIONS,
      AssetMention,
      ...(workspaceSlug
        ? [createMentionsExtension({ workspaceSlug, sourceAssetId })]
        : []),
    ],
    [sourceAssetId, workspaceSlug],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "note-rich-text-content min-h-full outline-none",
        spellcheck: "false",
      },
      handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
        if (event.key === "Escape" && highlightModeRef.current) {
          event.preventDefault();
          highlightPointerDownRef.current = false;
          onHighlightModeChangeRef.current?.(false);
          return true;
        }
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onSaveShortcutRef.current?.();
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        mousedown: (_view: unknown, event: Event) => {
          if (
            editableRef.current &&
            highlightModeRef.current &&
            event instanceof MouseEvent &&
            event.button === 0
          ) {
            highlightPointerDownRef.current = true;
          }
          return false;
        },
        mouseup: () => {
          const currentEditor = editorInstanceRef.current;
          if (
            !editableRef.current ||
            !highlightModeRef.current ||
            !highlightPointerDownRef.current ||
            !currentEditor
          )
            return false;

          highlightPointerDownRef.current = false;
          window.requestAnimationFrame(() => {
            if (!highlightModeRef.current) return;
            const { selection } = currentEditor.state;
            if (
              selection.empty ||
              currentEditor.isActive("codeBlock") ||
              !highlightColorRef.current
            )
              return;

            replaceHighlight(currentEditor, highlightColorRef.current);
            currentEditor.commands.setTextSelection(selection.to);
          });
          return false;
        },
      },
      handleClick: (_view: unknown, _position: number, event: MouseEvent) => {
        if (editableRef.current) return false;
        const target = event.target;
        const anchor =
          target instanceof Element ? target.closest("a[href]") : null;
        const href = anchor?.getAttribute("href");
        if (!href) return false;
        window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    }),
    [],
  );

  const editor = useEditor({
    extensions: noteExtensions,
    content: initialMarkdownRef.current,
    contentType: "markdown",
    editable,
    autofocus: false,
    // A restored drawer can mount during the initial page render, before its
    // portal has a stable DOM surface. Creating Tiptap after that commit keeps
    // its floating extensions from reading layout too early.
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current?.(currentEditor.getMarkdown());
    },
    editorProps,
  });
  editorInstanceRef.current = editor;

  useEffect(() => {
    editor?.setEditable(editable, false);
    if (!autoFocus) return;

    const focusFrame = window.requestAnimationFrame(() => {
      if (!editor) return;
      if (editable) {
        focusFirstNewLine(editor);
      } else {
        editor.commands.focus("end", { scrollIntoView: false });
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
    };
  }, [autoFocus, editable, editor]);

  useEffect(() => {
    if (!editor) return;

    const previewColor = highlightMode ? highlightColor : undefined;
    if (previewColor) {
      editor.view.dom.dataset.highlightPreview = previewColor;
      return;
    }
    delete editor.view.dom.dataset.highlightPreview;
  }, [editor, highlightColor, highlightMode]);

  useEffect(() => {
    if (!editor || editor.getMarkdown() === markdown) return;
    editor.commands.setContent(markdown, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, markdown]);

  useEffect(() => {
    if (!editor) return;

    let previousHasHighlight: boolean | undefined;
    const notifyHighlightSelectionChange = () => {
      const hasHighlight = hasHighlightInSelection(editor);
      if (hasHighlight === previousHasHighlight) return;
      previousHasHighlight = hasHighlight;
      onHighlightSelectionChangeRef.current?.(hasHighlight);
    };

    notifyHighlightSelectionChange();
    editor.on("transaction", notifyHighlightSelectionChange);
    return () => {
      editor.off("transaction", notifyHighlightSelectionChange);
    };
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => editor?.getMarkdown() ?? markdown,
      applyHighlight: (color) => {
        if (!editor || editor.state.selection.empty) return undefined;
        replaceHighlight(editor, color);
        return editor.getMarkdown();
      },
      removeHighlight: () => {
        if (!editor || editor.state.selection.empty) return undefined;
        editor.chain().focus().unsetHighlight().run();
        return editor.getMarkdown();
      },
      restoreMarkdown: (nextMarkdown) => {
        editor?.commands.setContent(nextMarkdown, {
          contentType: "markdown",
          emitUpdate: false,
        });
      },
    }),
    [editor, markdown],
  );

  if (!editor) return null;

  return (
    <NoteMentionProvider
      editor={editor}
      workspaceSlug={workspaceSlug}
      sourceAssetId={sourceAssetId}
      onOpen={onOpenMention}
    >
      {editable ? (
        <>
          <BubbleMenu
            editor={editor}
            className="z-[80]"
            options={{ placement: "top", offset: 8 }}
            shouldShow={({ state, editor: currentEditor }) =>
              currentEditor.isFocused &&
              !highlightMode &&
              !state.selection.empty &&
              !currentEditor.isActive("codeBlock")
            }
          >
            <InlineFormattingMenu
              editor={editor}
              onExtractSelection={onExtractSelection}
            />
          </BubbleMenu>
        </>
      ) : null}
      <div
        className="note-rich-text-editor-shell cursor-text"
        onMouseDownCapture={(event) => {
          if (!editable || editor.isFocused) return;
          if (
            event.target instanceof Node &&
            editor.view.dom.contains(event.target)
          ) {
            return;
          }
          if (
            event.target instanceof Element &&
            event.target.closest(
              "button, a, input, textarea, select, [contenteditable='false']",
            )
          ) {
            return;
          }
          event.preventDefault();
          focusFirstNewLine(editor);
        }}
      >
        <EditorContent
          editor={editor}
          className={cn(
            "note-rich-text min-h-full",
            editable && "note-rich-text-editable",
            className,
          )}
        />
      </div>
      {scrollContainerRef ? (
        <NotePreviewRail
          editor={editor}
          scrollContainerRef={scrollContainerRef}
        />
      ) : null}
    </NoteMentionProvider>
  );
});
