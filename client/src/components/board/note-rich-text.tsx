import {
  forwardRef,
  Fragment,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  BoldIcon,
  BracesIcon,
  CheckSquareIcon,
  CodeIcon,
  ChevronDownIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PilcrowIcon,
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
import Underline from "@tiptap/extension-underline";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import {
  EditorContent,
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
  NoteSelectionExtraActions,
  NoteSelectionMenuSurface,
} from "@/components/board/note-selection-actions";
import { AskaTaskItem } from "@/components/board/task-item";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { cn } from "@/lib/utils";
import { markdownFromSelection } from "@/lib/markdown";
import { GLASS_ISLAND_CLASS } from "@/lib/glass";

export type NoteRichTextHandle = {
  getMarkdown: () => string;
  toggleHighlight: () => string | undefined;
  restoreMarkdown: (markdown: string) => void;
};

type SlashCommandItem = {
  title: string;
  description: string;
  keywords: string[];
  icon: typeof PilcrowIcon;
  command: (editor: Editor, range: Range) => void;
};

type SlashCommandGroup = {
  label: string;
  items: SlashCommandItem[];
};

const OPEN_LINK_EDITOR_EVENT = "aska:open-link-editor";

const SLASH_COMMAND_GROUPS: SlashCommandGroup[] = [
  {
    label: "Basic blocks",
    items: [
      {
        title: "Text",
        description: "Just start writing with plain text.",
        keywords: ["paragraph", "plain", "p", "body"],
        icon: PilcrowIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).setParagraph().run(),
      },
      ...([1, 2, 3] as const).map((level) => ({
        title: `Heading ${level}`,
        description:
          level === 1
            ? "Big section heading."
            : level === 2
              ? "Medium section heading."
              : "Small section heading.",
        keywords: [`h${level}`, `heading${level}`],
        icon:
          level === 1
            ? Heading1Icon
            : level === 2
              ? Heading2Icon
              : Heading3Icon,
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
        icon: ListIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleBulletList().run(),
      },
      {
        title: "Numbered list",
        description: "Create a list with numbering.",
        keywords: ["ol", "ordered", "number"],
        icon: ListOrderedIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
      },
      {
        title: "To-do list",
        description: "Track tasks with checkboxes.",
        keywords: ["todo", "task", "checklist", "checkbox", "check"],
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
        icon: QuoteIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
      },
      {
        title: "Code block",
        description: "Capture a code snippet.",
        keywords: ["codeblock", "snippet", "fence", "pre"],
        icon: BracesIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
      },
      {
        title: "Divider",
        description: "Visually divide sections.",
        keywords: ["hr", "line", "separator", "rule"],
        icon: MinusIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
      },
      {
        title: "Table",
        description: "Insert a table with a header row.",
        keywords: ["grid", "cells", "rows"],
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

function CodeBlockLanguagePicker({ editor }: { editor: Editor }) {
  const language = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) =>
      currentEditor.isActive("codeBlock")
        ? (currentEditor.getAttributes("codeBlock").language ?? "")
        : "",
  });

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-xl backdrop-blur-xl">
      <select
        aria-label="Code block language"
        className="h-8 cursor-pointer rounded-md bg-transparent px-1.5 text-xs font-medium outline-none"
        value={language}
        onChange={(event) => {
          editor
            .chain()
            .focus()
            .updateAttributes("codeBlock", {
              language: event.target.value || null,
            })
            .run();
        }}
      >
        {CODE_BLOCK_LANGUAGES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const NOTE_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      autolink: true,
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    },
    codeBlock: false,
  }),
  Underline,
  CodeBlockLowlight.configure({
    lowlight: createLowlight(common),
    defaultLanguage: null,
  }),
  TableKit.configure({ table: { resizable: true } }),
  TaskList,
  AskaTaskItem.configure({ nested: true }),
  Highlight.extend({ inclusive: false }).configure({
    HTMLAttributes: { class: "note-highlight" },
  }),
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
      return "Type '/' for commands…";
    },
  }),
  Markdown.configure({
    markedOptions: { gfm: true, breaks: false },
  }),
  SlashCommands,
];

function InlineFormattingMenu({
  editor,
  onExtractSelection,
  onHighlightSelection,
  isHighlighting,
}: {
  editor: Editor;
  onExtractSelection?: (content: string) => void;
  onHighlightSelection?: (markdown: string) => void;
  isHighlighting?: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [blockStyleOpen, setBlockStyleOpen] = useState(false);
  const [href, setHref] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const active = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      code: currentEditor.isActive("code"),
      link: currentEditor.isActive("link"),
      highlight: currentEditor.isActive("highlight"),
      strike: currentEditor.isActive("strike"),
      underline: currentEditor.isActive("underline"),
      heading1: currentEditor.isActive("heading", { level: 1 }),
      heading2: currentEditor.isActive("heading", { level: 2 }),
      heading3: currentEditor.isActive("heading", { level: 3 }),
    }),
  });

  function toggleLinkInput() {
    setHref(editor.getAttributes("link").href ?? "");
    setLinkOpen((open) => !open);
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
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
    setLinkOpen(false);
    editor.commands.setTextSelection(selectionEnd);
    editor.commands.blur();
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        menuRef.current?.contains(target) ||
        (target instanceof Element &&
          target.closest('[data-slot="dropdown-menu-content"]'))
      ) {
        return;
      }

      if (linkOpen || blockStyleOpen) {
        // A popover owns the first outside interaction. Keep the editor range
        // intact so closing it does not also dismiss the selection toolbar.
        event.preventDefault();
        setLinkOpen(false);
        setBlockStyleOpen(false);
        requestAnimationFrame(() => editor.commands.focus());
        return;
      }

      if (!editor.view.dom.contains(target)) {
        editor.commands.setTextSelection(editor.state.selection.to);
        editor.commands.blur();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [blockStyleOpen, editor, linkOpen]);

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
      label: "Inline code",
      icon: CodeIcon,
      active: active?.code ?? false,
      action: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "Link",
      icon: LinkIcon,
      active: active?.link ?? false,
      action: toggleLinkInput,
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
    ...(!onHighlightSelection
      ? [
          {
            label: "Highlight",
            icon: HighlighterIcon,
            active: active?.highlight ?? false,
            action: () => editor.chain().focus().toggleHighlight().run(),
          },
        ]
      : []),
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

  function highlightSelection() {
    if (!onHighlightSelection) return;
    editor.chain().focus().toggleHighlight().run();
    onHighlightSelection(editor.getMarkdown());
  }

  return (
    <div ref={menuRef}>
      <NoteSelectionMenuSurface>
        <div className={GLASS_ISLAND_CLASS}>
          <ButtonGroup>
            <DropdownMenu
              open={blockStyleOpen}
              onOpenChange={(open) => {
                setBlockStyleOpen(open);
                if (!open) {
                  requestAnimationFrame(() => editor.commands.focus());
                }
              }}
            >
              <DropdownMenuTrigger
                render={
                  <button
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground"
                    type="button"
                    aria-label="Change block style"
                    onMouseDown={(event) => event.preventDefault()}
                  />
                }
              >
                <span>
                  {active?.heading1
                    ? "Heading 1"
                    : active?.heading2
                      ? "Heading 2"
                      : active?.heading3
                        ? "Heading 3"
                        : "Text"}
                </span>
                <ChevronDownIcon className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8}>
                <DropdownMenuItem
                  onClick={() => editor.chain().focus().setParagraph().run()}
                >
                  Text
                </DropdownMenuItem>
                {[1, 2, 3].map((level) => (
                  <DropdownMenuItem
                    key={level}
                    onClick={() =>
                      editor.chain().focus().setNode("heading", { level }).run()
                    }
                  >
                    Heading {level}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
        <div className={GLASS_ISLAND_CLASS}>
          <ButtonGroup>
            {controls.map((control, index) => {
              const Icon = control.icon;
              return (
                <Fragment key={control.label}>
                  {index > 0 ? (
                    <ButtonGroupSeparator className="bg-border/70" />
                  ) : null}
                  <button
                    data-slot="button"
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md text-foreground hover:bg-accent hover:text-foreground",
                      control.active && "bg-accent text-foreground",
                    )}
                    type="button"
                    title={control.label}
                    aria-label={control.label}
                    aria-pressed={control.active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={
                      control.label === "Highlight" && onHighlightSelection
                        ? highlightSelection
                        : control.action
                    }
                  >
                    <Icon className="size-3.5" />
                  </button>
                </Fragment>
              );
            })}
          </ButtonGroup>
        </div>
        {onExtractSelection && onHighlightSelection ? (
          <div className={GLASS_ISLAND_CLASS}>
            <ButtonGroup>
              <NoteSelectionExtraActions
                onExtract={extractSelection}
                onHighlight={highlightSelection}
                isHighlightActive={active?.highlight ?? false}
                isHighlighting={isHighlighting}
              />
            </ButtonGroup>
          </div>
        ) : null}
      </NoteSelectionMenuSurface>
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
    onHighlightSelection?: (markdown: string) => void;
    isHighlighting?: boolean;
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
    onHighlightSelection,
    isHighlighting,
  },
  ref,
) {
  const onChangeRef = useRef(onChange);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const editableRef = useRef(editable);
  onChangeRef.current = onChange;
  onSaveShortcutRef.current = onSaveShortcut;
  editableRef.current = editable;

  const editor = useEditor({
    extensions: NOTE_EXTENSIONS,
    content: markdown,
    contentType: "markdown",
    editable,
    autofocus: autoFocus ? "end" : false,
    immediatelyRender: true,
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current?.(currentEditor.getMarkdown());
    },
    editorProps: {
      attributes: {
        class: "note-rich-text-content min-h-full outline-none",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          onSaveShortcutRef.current?.();
          return true;
        }
        return false;
      },
      handleClick: (_view, _position, event) => {
        if (editableRef.current) return false;
        const target = event.target;
        const anchor =
          target instanceof Element ? target.closest("a[href]") : null;
        const href = anchor?.getAttribute("href");
        if (!href) return false;
        window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
    if (!editable || !autoFocus) return;

    let settleFrame = 0;
    const focusAndScrollToEnd = () => {
      editor?.commands.focus("end");
      const container = scrollContainerRef?.current;
      if (container) container.scrollTop = container.scrollHeight;
    };

    const focusFrame = window.requestAnimationFrame(() => {
      editor?.commands.focus("end");
      settleFrame = window.requestAnimationFrame(focusAndScrollToEnd);
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
    };
  }, [autoFocus, editable, editor, scrollContainerRef]);

  useEffect(() => {
    if (!editor || editor.getMarkdown() === markdown) return;
    editor.commands.setContent(markdown, {
      contentType: "markdown",
      emitUpdate: false,
    });
  }, [editor, markdown]);

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => editor?.getMarkdown() ?? markdown,
      toggleHighlight: () => {
        if (!editor || editor.state.selection.empty) return undefined;
        editor.commands.toggleHighlight();
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
    <>
      {editable ? (
        <>
          <BubbleMenu
            editor={editor}
            options={{ placement: "top", offset: 8 }}
            shouldShow={({ state, editor: currentEditor }) =>
              currentEditor.isFocused &&
              !state.selection.empty &&
              !currentEditor.isActive("codeBlock")
            }
          >
            <InlineFormattingMenu
              editor={editor}
              onExtractSelection={onExtractSelection}
              onHighlightSelection={onHighlightSelection}
              isHighlighting={isHighlighting}
            />
          </BubbleMenu>
          <BubbleMenu
            editor={editor}
            options={{ placement: "top", offset: 8 }}
            shouldShow={({ editor: currentEditor }) =>
              currentEditor.isActive("codeBlock")
            }
          >
            <CodeBlockLanguagePicker editor={editor} />
          </BubbleMenu>
        </>
      ) : null}
      <EditorContent
        editor={editor}
        className={cn(
          "note-rich-text min-h-full",
          editable && "note-rich-text-editable",
          className,
        )}
      />
      {editable && scrollContainerRef ? (
        <NotePreviewRail
          editor={editor}
          scrollContainerRef={scrollContainerRef}
        />
      ) : null}
    </>
  );
});
