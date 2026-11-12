import { Extension, type Editor, type Range } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  CaseSensitiveIcon,
  CheckSquareIcon,
  CodeXmlIcon,
  ImageIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  QuoteIcon,
  TableIcon,
  WorkflowIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { headingIconForLevel } from "../blocks/note-heading-icon";

import {
  getSlashMenuScrollTop,
  type SlashMenuNavigationDirection,
} from "@/components/board/slash-menu-scroll";
import { DEFAULT_MERMAID_SOURCE } from "@/lib/diagram";
import { FLOATING_GLASS_BACKDROP_CLASS, GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

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

function insertRemoteImage(editor: Editor, range: Range) {
  const source = window.prompt("Paste an image URL")?.trim();
  if (!source) return;

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    toast.error("Enter a valid HTTPS image URL.");
    return;
  }
  if (url.protocol !== "https:") {
    toast.error("Use an HTTPS image URL.");
    return;
  }

  editor.chain().focus().deleteRange(range).setImage({ src: url.href }).run();
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
        icon: CodeXmlIcon,
        command: (editor, range) =>
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
      },
      {
        title: "Image",
        description: "Embed an image from a URL.",
        keywords: ["photo", "picture", "media"],
        icon: ImageIcon,
        command: insertRemoteImage,
      },
      {
        title: "Diagram",
        description: "Insert a Mermaid diagram.",
        keywords: ["mermaid", "flowchart", "graph"],
        icon: WorkflowIcon,
        command: (editor, range) =>
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "mermaidBlock",
              attrs: { source: DEFAULT_MERMAID_SOURCE },
            })
            .run(),
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

function SlashBlockPreview({ item }: { item: SlashCommandItem }) {
  const headingLevel = item.title.startsWith("Heading ")
    ? Number(item.title.slice(-1))
    : null;

  if (headingLevel) {
    return (
      <div
        className={cn(
          "whitespace-nowrap font-semibold tracking-tight text-foreground",
          headingLevel === 1 && "text-2xl",
          headingLevel === 2 && "text-xl",
          headingLevel === 3 && "text-lg",
          headingLevel === 4 && "text-base",
        )}
      >
        {item.title}
      </div>
    );
  }

  switch (item.title) {
    case "Text":
      return <p className="text-sm leading-6 whitespace-nowrap">Text</p>;
    case "Bullet list":
      return (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-0">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-current"
            />
            <span>First idea</span>
          </div>
          <div className="flex items-center gap-0">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-current"
            />
            <span>Another idea</span>
          </div>
        </div>
      );
    case "Numbered list":
      return (
        <ol className="list-inside list-decimal space-y-1 text-sm">
          <li>First step</li>
          <li>Next step</li>
        </ol>
      );
    case "To-do list":
      return (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded border border-foreground/45" />
            Plan the work
          </div>
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded border border-foreground/45" />
            Get it done
          </div>
        </div>
      );
    case "Quote":
      return (
        <blockquote className="border-l-2 border-foreground/45 pl-3 text-sm italic">
          A thought worth keeping.
        </blockquote>
      );
    case "Code block":
      return (
        <pre className="overflow-hidden rounded-md bg-muted p-2.5 font-mono text-xs text-foreground">
          <code>const idea = "hello";</code>
        </pre>
      );
    case "Image":
      return (
        <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border border-border bg-linear-to-br from-sky-200 via-indigo-100 to-rose-100 dark:from-sky-950 dark:via-indigo-950 dark:to-rose-950">
          <ImageIcon className="size-7 text-foreground/55" strokeWidth={1.5} />
        </div>
      );
    case "Diagram":
      return (
        <div className="flex items-center justify-center gap-2 py-1 text-[10px] font-medium">
          <span className="rounded border bg-background px-2 py-1">Idea</span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded border bg-background px-2 py-1">Action</span>
        </div>
      );
    case "Divider":
      return <div className="my-2 border-t border-border" />;
    case "Table":
      return (
        <div className="grid grid-cols-3 overflow-hidden rounded border border-border text-[10px]">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              key={index}
              className={cn(
                "min-h-6 border-r border-b border-border px-1 py-1",
                index < 3 && "bg-muted font-semibold",
                index % 3 === 2 && "border-r-0",
                index >= 6 && "border-b-0",
              )}
            >
              {index < 3 ? `Column ${index + 1}` : "Text"}
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

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

type SlashMenuProps = SuggestionProps<SlashCommandGroup, SlashCommandItem>;

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  function SlashMenu({ items, query, command }, ref) {
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
    const [hasMoreBelow, setHasMoreBelow] = useState(false);
    const [previewPosition, setPreviewPosition] = useState<{
      top: number;
      left: number;
      side: "left" | "right" | "stacked";
    } | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef(new Map<number, HTMLButtonElement>());
    const navigationDirectionRef = useRef<SlashMenuNavigationDirection | null>(
      null,
    );

    useEffect(() => {
      navigationDirectionRef.current = null;
      setSelectedIndex(0);
      if (listRef.current) listRef.current.scrollTop = 0;
    }, [flatItems]);

    useLayoutEffect(() => {
      const list = listRef.current;
      if (!list) return;

      const updateFade = () => {
        setHasMoreBelow(
          list.scrollHeight - list.clientHeight - list.scrollTop > 1,
        );
      };
      updateFade();
      list.addEventListener("scroll", updateFade, { passive: true });
      const observer = new ResizeObserver(updateFade);
      observer.observe(list);
      return () => {
        list.removeEventListener("scroll", updateFade);
        observer.disconnect();
      };
    }, [flatItems]);

    useLayoutEffect(() => {
      const direction = navigationDirectionRef.current;
      const list = listRef.current;
      const item = itemRefs.current.get(selectedIndex);
      navigationDirectionRef.current = null;
      if (!direction || !list || !item) return;

      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const nextScrollTop = getSlashMenuScrollTop({
        direction,
        selectedIndex,
        itemCount: flatItems.length,
        itemTop: itemRect.top - listRect.top + list.scrollTop,
        itemHeight: itemRect.height,
        scrollTop: list.scrollTop,
        clientHeight: list.clientHeight,
        scrollHeight: list.scrollHeight,
      });
      list.scrollTop = nextScrollTop;
    }, [flatItems.length, selectedIndex]);

    useLayoutEffect(() => {
      const list = listRef.current;
      const item = itemRefs.current.get(selectedIndex);
      const surface = surfaceRef.current;
      if (!list || !item || !surface) return;

      const updatePosition = () => {
        const surfaceRect = surface.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        const menuRect = list.getBoundingClientRect();
        const scaleX = surfaceRect.width / surface.offsetWidth || 1;
        const scaleY = surfaceRect.height / surface.offsetHeight || 1;
        const surfaceLeft =
          surfaceRect.left - (surface.offsetWidth - surfaceRect.width) / 2;
        const surfaceTop =
          surfaceRect.top - (surface.offsetHeight - surfaceRect.height) / 2;
        const menuLeft =
          surfaceLeft + (menuRect.left - surfaceRect.left) / scaleX;
        const menuRight =
          surfaceLeft + (menuRect.right - surfaceRect.left) / scaleX;
        const menuTop = surfaceTop + (menuRect.top - surfaceRect.top) / scaleY;
        const menuBottom =
          surfaceTop + (menuRect.bottom - surfaceRect.top) / scaleY;
        const itemTop = surfaceTop + (itemRect.top - surfaceRect.top) / scaleY;
        const cardWidth = 208;
        const cardHeight = 170;
        const gap = 8;
        const margin = 8;
        const right = menuRight + gap;
        const left = menuLeft - cardWidth - gap;
        const hasRoomOnRight = right + cardWidth + margin <= window.innerWidth;
        const hasRoomOnLeft = left >= margin;
        const fitsBesideMenu = hasRoomOnRight || hasRoomOnLeft;
        setPreviewPosition({
          side: hasRoomOnRight ? "right" : hasRoomOnLeft ? "left" : "stacked",
          left: fitsBesideMenu
            ? hasRoomOnRight
              ? right
              : menuLeft - gap
            : Math.max(
                margin,
                Math.min(menuLeft, window.innerWidth - cardWidth - margin),
              ),
          top: fitsBesideMenu
            ? Math.max(
                margin,
                Math.min(
                  itemTop - 12,
                  window.innerHeight - cardHeight - margin,
                ),
              )
            : menuBottom + gap + cardHeight + margin <= window.innerHeight
              ? menuBottom + gap
              : Math.max(margin, menuTop - cardHeight - gap),
        });
      };

      // The suggestion surface is mounted into its floating container after
      // React renders; measure once that container has been positioned.
      const frame = window.requestAnimationFrame(updatePosition);
      list.addEventListener("scroll", updatePosition, { passive: true });
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.cancelAnimationFrame(frame);
        list.removeEventListener("scroll", updatePosition);
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [flatItems, selectedIndex]);

    function select(index: number) {
      const item = flatItems[index];
      if (item) command(item);
    }

    function moveSelection(direction: SlashMenuNavigationDirection) {
      setSelectedIndex((index) => {
        if (flatItems.length === 0) return 0;
        const nextIndex =
          direction === "up"
            ? (index + flatItems.length - 1) % flatItems.length
            : (index + 1) % flatItems.length;
        if (nextIndex !== index) navigationDirectionRef.current = direction;
        return nextIndex;
      });
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "Escape") {
          // Let the suggestion plugin dismiss the menu without allowing the
          // enclosing note workspace to handle the same Escape key.
          event.stopPropagation();
          return false;
        }
        if (event.key === "ArrowUp") {
          moveSelection("up");
          return true;
        }
        if (event.key === "ArrowDown") {
          moveSelection("down");
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
        <div className="w-64">
          <div className="overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
            <p className="px-3 py-2.5 text-xs text-muted-foreground">
              No blocks match “{query}”
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("relative w-64", FLOATING_GLASS_BACKDROP_CLASS)}>
        <div
          ref={surfaceRef}
          className={cn(
            "relative z-10 overflow-hidden rounded-lg text-popover-foreground shadow-2xl",
            GLASS_FRAME_CLASS,
          )}
        >
          <div className="relative z-10 overflow-hidden rounded-b-lg border-b border-border bg-background">
            <div
              ref={listRef}
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
                          onMouseEnter={() => {
                            navigationDirectionRef.current = null;
                            setSelectedIndex(index);
                          }}
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
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-background to-transparent transition-opacity duration-150 motion-reduce:transition-none",
                hasMoreBelow ? "opacity-100" : "opacity-0",
              )}
            />
          </div>
        </div>
        {previewPosition && typeof document !== "undefined"
          ? createPortal(
              <div
                className={cn(
                  "pointer-events-none fixed w-max max-w-[min(13rem,calc(100vw-1rem))] rounded-lg border border-border bg-accent p-2 text-accent-foreground shadow-none",
                  previewPosition.side === "left" && "-translate-x-full",
                )}
                style={{
                  left: previewPosition.left,
                  top: previewPosition.top,
                  zIndex: 71,
                }}
                aria-hidden="true"
              >
                <div
                  className={cn(
                    "w-full rounded-md border border-border bg-background p-2 text-foreground",
                  )}
                >
                  {flatItems[selectedIndex] ? (
                    <SlashBlockPreview item={flatItems[selectedIndex]} />
                  ) : null}
                </div>
                <p className="mt-1.5 max-w-40 text-xs leading-4 text-muted-foreground">
                  {flatItems[selectedIndex]?.description}
                </p>
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  },
);

export const SlashCommands = Extension.create({
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
            | ReactRenderer<SlashMenuHandle, SlashMenuProps>
            | undefined;
          let unmount: (() => void) | undefined;

          const cleanup = () => {
            unmount?.();
            renderer?.destroy();
            renderer = undefined;
            unmount = undefined;
          };

          return {
            onStart: (props) => {
              cleanup();
              renderer = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props,
              });
              // Suggestions mount under document.body. Keep the menu above the
              // full-screen note workspace instead of behind its dialog layer.
              renderer.element.style.zIndex = "70";
              unmount = props.mount(renderer.element);
            },
            onUpdate: (props) => {
              if (!renderer) return;
              renderer.updateProps(props);
            },
            onKeyDown: (props) => renderer?.ref?.onKeyDown(props) ?? false,
            onExit: cleanup,
          };
        },
      }),
    ];
  },
});
