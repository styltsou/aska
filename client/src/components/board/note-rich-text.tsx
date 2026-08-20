import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  BracesIcon,
  CheckSquareIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ListIcon,
  ListOrderedIcon,
  BoldIcon,
  CodeIcon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  MinusIcon,
  PilcrowIcon,
  QuoteIcon,
} from "lucide-react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";

import { cn } from "@/lib/utils";

export type NoteRichTextHandle = {
  getMarkdown: () => string;
  toggleHighlight: () => string | undefined;
  restoreMarkdown: (markdown: string) => void;
};

type SlashCommandItem = {
  title: string;
  description: string;
  icon: typeof PilcrowIcon;
  command: (editor: Editor, range: Range) => void;
};

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: "Text",
    description: "Plain paragraph",
    icon: PilcrowIcon,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  ...([1, 2, 3] as const).map((level) => ({
    title: `Heading ${level}`,
    description: level === 1 ? "Large section heading" : "Section heading",
    icon:
      level === 1 ? Heading1Icon : level === 2 ? Heading2Icon : Heading3Icon,
    command: (editor: Editor, range: Range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNode("heading", { level })
        .run(),
  })),
  {
    title: "Bullet list",
    description: "Create a simple list",
    icon: ListIcon,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "Create a numbered list",
    icon: ListOrderedIcon,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    description: "Track a small set of tasks",
    icon: CheckSquareIcon,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Set text apart",
    icon: QuoteIcon,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Preserve code formatting",
    icon: BracesIcon,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "Separate two ideas",
    icon: MinusIcon,
    command: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

type SlashMenuHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

const SlashMenu = forwardRef<
  SlashMenuHandle,
  SuggestionProps<SlashCommandItem, SlashCommandItem>
>(function SlashMenu({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => setSelectedIndex(0), [items]);

  function select(index: number) {
    const item = items[index];
    if (item) command(item);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((index) =>
          items.length === 0 ? 0 : (index + items.length - 1) % items.length,
        );
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((index) =>
          items.length === 0 ? 0 : (index + 1) % items.length,
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

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-xl">
        No matching blocks
      </div>
    );
  }

  return (
    <div
      className="w-64 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl"
      role="listbox"
      aria-label="Insert block"
    >
      <p className="px-2 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Turn into
      </p>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left",
              index === selectedIndex ? "bg-accent" : "hover:bg-accent/60",
            )}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {item.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

const SlashCommands = Extension.create({
  name: "slashCommands",
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        char: "/",
        startOfLine: true,
        items: ({ query }) => {
          const normalized = query.trim().toLowerCase();
          return SLASH_COMMANDS.filter((item) =>
            `${item.title} ${item.description}`
              .toLowerCase()
              .includes(normalized),
          );
        },
        command: ({ editor, range, props }) => props.command(editor, range),
        render: () => {
          let renderer:
            | ReactRenderer<
                SlashMenuHandle,
                SuggestionProps<SlashCommandItem, SlashCommandItem>
              >
            | undefined;
          let unmount: (() => void) | undefined;

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props,
              });
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

const NOTE_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: {
      autolink: true,
      openOnClick: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    },
    strike: false,
    underline: false,
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({
    HTMLAttributes: { class: "note-highlight" },
  }),
  Placeholder.configure({
    placeholder: "Write something… Type / for blocks",
  }),
  Markdown.configure({
    markedOptions: { gfm: true, breaks: false },
  }),
  SlashCommands,
];

function InlineFormattingMenu({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");

  function toggleLinkInput() {
    setHref(editor.getAttributes("link").href ?? "");
    setLinkOpen((open) => !open);
  }

  function applyLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = href.trim();
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
  }

  if (linkOpen) {
    return (
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
        <button
          className="h-8 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground"
          type="submit"
        >
          Apply
        </button>
      </form>
    );
  }

  const controls = [
    {
      label: "Bold",
      icon: BoldIcon,
      active: editor.isActive("bold"),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: ItalicIcon,
      active: editor.isActive("italic"),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Inline code",
      icon: CodeIcon,
      active: editor.isActive("code"),
      action: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: "Link",
      icon: LinkIcon,
      active: editor.isActive("link"),
      action: toggleLinkInput,
    },
    {
      label: "Highlight",
      icon: HighlighterIcon,
      active: editor.isActive("highlight"),
      action: () => editor.chain().focus().toggleHighlight().run(),
    },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-xl backdrop-blur-xl">
      {controls.map((control) => {
        const Icon = control.icon;
        return (
          <button
            key={control.label}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
              control.active && "bg-accent text-foreground",
            )}
            type="button"
            title={control.label}
            aria-label={control.label}
            aria-pressed={control.active}
            onMouseDown={(event) => event.preventDefault()}
            onClick={control.action}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
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
    onChange?: (markdown: string) => void;
    onSaveShortcut?: () => void;
  }
>(function NoteRichText(
  { markdown, editable, autoFocus, className, onChange, onSaveShortcut },
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
    if (editable && autoFocus) {
      requestAnimationFrame(() => editor?.commands.focus("end"));
    }
  }, [autoFocus, editable, editor]);

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
        <BubbleMenu
          editor={editor}
          options={{ placement: "top", offset: 8 }}
          shouldShow={({ state }) => !state.selection.empty}
        >
          <InlineFormattingMenu editor={editor} />
        </BubbleMenu>
      ) : null}
      <EditorContent
        editor={editor}
        className={cn(
          "note-rich-text min-h-full",
          editable && "note-rich-text-editable",
          className,
        )}
      />
    </>
  );
});
