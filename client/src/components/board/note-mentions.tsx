import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
  FileTextIcon,
} from "lucide-react";
import { Extension, Node, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  ReactRenderer,
  useEditorState,
  type ReactNodeViewProps,
} from "@tiptap/react";
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";

import { searchNoteMentions } from "@/api/note-mentions/fetchers";
import {
  isMentionSearchCacheFresh,
  mentionSearchQueryOptions,
  RECENT_MENTION_LIMIT,
  useResolvedNoteMentions,
} from "@/api/note-mentions/hooks";
import type {
  MentionSearchInput,
  NoteMentionTarget,
  NoteMentionType,
} from "@/api/note-mentions/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  SuggestionMenuTransition,
  SUGGESTION_MENU_EXIT_FALLBACK_MS,
  type SuggestionMenuTransitionProps,
} from "@/components/board/suggestion-menu-transition";
import { gradientToCss } from "@/lib/color-gradient";
import { FLOATING_GLASS_BACKDROP_CLASS, GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";

export type OpenNoteMentionTarget = (
  identity: { assetId: number; assetType: NoteMentionType },
  resolved?: NoteMentionTarget,
) => void;

type MentionContextValue = {
  targets: ReadonlyMap<string, NoteMentionTarget>;
  resolutionComplete: boolean;
  onOpen?: OpenNoteMentionTarget;
};

const MentionContext = createContext<MentionContextValue>({
  targets: new Map(),
  resolutionComplete: false,
});
const mentionSuggestionPluginKey = new PluginKey("assetMentionSuggestion");

export const AssetMention = Node.create({
  name: "assetMention",
  priority: 1_100,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  markdownTokenName: "link",
  addAttributes() {
    return {
      targetAssetId: { default: null },
      assetType: { default: "note" },
      fallbackLabel: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-asset-mention]" }];
  },
  renderHTML({ node }) {
    return [
      "span",
      {
        "data-asset-mention": node.attrs.assetType,
        "data-target-asset-id": String(node.attrs.targetAssetId),
        "data-fallback-label": node.attrs.fallbackLabel,
      },
      `@${node.attrs.fallbackLabel}`,
    ];
  },
  parseMarkdown(token, helpers) {
    const match = /^(note|color):(\d+)$/.exec(token.href ?? "");
    if (!match) {
      return helpers.applyMark(
        "link",
        helpers.parseInline(token.tokens ?? []),
        { href: token.href, title: token.title || null },
      );
    }
    return {
      type: "assetMention",
      attrs: {
        targetAssetId: Number(match[2]),
        assetType: match[1],
        fallbackLabel: token.text ?? "",
      },
    };
  },
  renderMarkdown(node) {
    const label = escapeMentionLabel(String(node.attrs?.fallbackLabel ?? ""));
    return `[${label}](${node.attrs?.assetType}:${node.attrs?.targetAssetId})`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteMentionChip);
  },
});

export function NoteMentionProvider({
  editor,
  workspaceSlug,
  sourceAssetId,
  onOpen,
  children,
}: {
  editor: Editor;
  workspaceSlug?: string;
  sourceAssetId?: number;
  onOpen?: OpenNoteMentionTarget;
  children: ReactNode;
}) {
  const targetSignature =
    useEditorState({
      editor,
      selector: ({ editor: currentEditor }) => {
        if (!currentEditor || currentEditor.isDestroyed || !currentEditor.state)
          return "";

        const targets = new Map<
          string,
          { assetId: number; assetType: NoteMentionType }
        >();
        currentEditor.state.doc.descendants((node) => {
          if (node.type.name !== "assetMention") return;
          const assetId = Number(node.attrs.targetAssetId);
          const assetType = node.attrs.assetType as NoteMentionType;
          if (
            Number.isSafeInteger(assetId) &&
            (assetType === "note" || assetType === "color")
          )
            targets.set(`${assetType}:${assetId}`, { assetId, assetType });
        });
        return [...targets.values()]
          .sort(
            (left, right) =>
              left.assetId - right.assetId ||
              left.assetType.localeCompare(right.assetType),
          )
          .map((target) => `${target.assetType}:${target.assetId}`)
          .join(",");
      },
    }) ?? "";
  const targetIdentities = useMemo(
    () =>
      targetSignature
        .split(",")
        .filter(Boolean)
        .map((value) => {
          const [assetType, id] = value.split(":");
          return {
            assetId: Number(id),
            assetType: assetType as NoteMentionType,
          };
        }),
    [targetSignature],
  );
  const resolution = useResolvedNoteMentions(
    workspaceSlug,
    sourceAssetId,
    targetIdentities,
  );
  const targets = useMemo(
    () =>
      new Map(
        (resolution.data ?? []).map((target) => [
          `${target.assetType}:${target.assetId}`,
          target,
        ]),
      ),
    [resolution.data],
  );
  const value = useMemo<MentionContextValue>(
    () => ({
      targets,
      resolutionComplete: resolution.isSuccess,
      onOpen,
    }),
    [onOpen, resolution.isSuccess, targets],
  );

  return (
    <MentionContext.Provider value={value}>{children}</MentionContext.Provider>
  );
}

function NoteMentionChip({ node, selected }: ReactNodeViewProps) {
  const { targets, resolutionComplete, onOpen } = useContext(MentionContext);
  const assetId = Number(node.attrs.targetAssetId);
  const assetType = node.attrs.assetType as NoteMentionType;
  const fallbackLabel = String(node.attrs.fallbackLabel ?? "Untitled");
  const resolved = targets.get(`${assetType}:${assetId}`);
  const unavailable = resolutionComplete && !resolved;
  const label = resolved?.label || fallbackLabel;
  const chip = (
    <button
      type="button"
      disabled={unavailable || !onOpen}
      className={cn(
        "note-mention-chip",
        selected && "note-mention-chip--selected",
        unavailable && "note-mention-chip--unavailable",
      )}
      aria-label={`${unavailable ? "Unavailable reference" : "Open reference"}: ${label}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onOpen?.({ assetId, assetType }, resolved)}
    >
      <span aria-hidden="true">@</span>
      {assetType === "color" ? (
        <span
          aria-hidden="true"
          className="note-mention-swatch"
          style={{
            background: resolved?.gradient
              ? gradientToCss(
                  resolved.gradient.stops ?? [
                    { color: resolved.gradient.from, position: 0 },
                    { color: resolved.gradient.to, position: 100 },
                  ],
                  resolved.gradient.type ?? "linear",
                  resolved.gradient.angle,
                )
              : (resolved?.hex ?? "currentColor"),
          }}
        />
      ) : null}
      <span className="max-w-64 truncate">{label}</span>
    </button>
  );

  return (
    <NodeViewWrapper as="span" className="inline" contentEditable={false}>
      {assetType === "note" && resolved ? (
        <HoverCard>
          <HoverCardTrigger delay={260} closeDelay={80} render={chip} />
          <HoverCardContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-80 overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl"
          >
            <div className="p-3.5">
              <p className="truncate text-sm font-semibold text-foreground">
                {resolved.label}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {resolved.locationLabel}
              </p>
              <div className="relative mt-3 h-10 overflow-hidden">
                <p className="text-xs leading-5 text-muted-foreground">
                  {resolved.snippet || "No note preview yet."}
                </p>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-b from-transparent to-background/95"
                />
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      ) : (
        chip
      )}
    </NodeViewWrapper>
  );
}

type MentionMenuHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

type MentionMenuProps = SuggestionProps<
  NoteMentionTarget,
  NoteMentionTarget
> & {
  cachedItems?: NoteMentionTarget[];
  isSearchPending?: boolean;
} & Pick<SuggestionMenuTransitionProps, "exiting" | "onExitComplete">;

export function getMentionMenuDisplayItems({
  items,
  cachedItems,
  lastResolvedItems,
  loading,
}: {
  items: NoteMentionTarget[];
  cachedItems?: NoteMentionTarget[];
  lastResolvedItems: NoteMentionTarget[];
  loading: boolean;
}): NoteMentionTarget[] {
  return loading ? (cachedItems ?? lastResolvedItems) : items;
}

export function filterRecentMentionTargets(
  targets: NoteMentionTarget[],
  parsed: { scope?: NoteMentionType; search: string },
): NoteMentionTarget[] {
  const search = parsed.search.trim().toLowerCase();
  return targets.filter((target) => {
    if (parsed.scope && target.assetType !== parsed.scope) return false;
    if (!search) return true;

    const gradientLabel = target.gradient
      ? `${target.gradient.type === "radial" ? "radial" : "linear"} gradient`
      : "";
    return [target.title, target.hex, gradientLabel].some((value) =>
      value?.toLowerCase().includes(search),
    );
  });
}

const MentionMenu = forwardRef<MentionMenuHandle, MentionMenuProps>(
  function MentionMenu(
    {
      items,
      cachedItems,
      isSearchPending,
      loading,
      query,
      command,
      editor,
      range,
      exiting,
      onExitComplete,
    },
    ref,
  ) {
    const parsed = parseMentionQuery(query);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [lastResolvedItems, setLastResolvedItems] = useState<
      NoteMentionTarget[]
    >([]);
    const itemRefs = useRef(new Map<number, HTMLButtonElement>());
    const displayItems = getMentionMenuDisplayItems({
      items,
      cachedItems,
      lastResolvedItems,
      loading,
    });
    const { notes, colors, flatItems } = useMemo(() => {
      const nextNotes = displayItems.filter(
        (item) => item.assetType === "note",
      );
      const nextColors = displayItems.filter(
        (item) => item.assetType === "color",
      );
      return {
        notes: nextNotes,
        colors: nextColors,
        flatItems: [...nextNotes, ...nextColors],
      };
    }, [displayItems]);
    const showScopeControls = notes.length > 0 && colors.length > 0;
    const showGroupLabels = notes.length > 0 && colors.length > 0;
    const showInitialLoading = loading && flatItems.length === 0;
    const showSearching = Boolean(isSearchPending);
    const emptyLabel = query
      ? parsed.scope === "note"
        ? "No notes match"
        : parsed.scope === "color"
          ? "No colors match"
          : "No mentions match"
      : "No notes or colors to mention yet";

    useEffect(() => setSelectedIndex(0), [flatItems]);
    useEffect(() => {
      if (!loading) setLastResolvedItems(items);
    }, [items, loading]);
    useEffect(() => {
      itemRefs.current.get(selectedIndex)?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    function select(index: number) {
      const item = flatItems[index];
      if (item) command(item);
    }

    function setScope(scope?: NoteMentionType) {
      const next = createMentionScopeQuery(scope, query);
      editor.chain().focus().insertContentAt(range, next).run();
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "Escape") {
          // The suggestion plugin clears its own state after this callback. Stop
          // the native event here so an enclosing note workspace does not treat
          // the same Escape as a request to close the note.
          event.stopPropagation();
          return false;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((index) => {
            if (flatItems.length === 0) return 0;
            const direction = event.key === "ArrowUp" ? -1 : 1;
            return (index + direction + flatItems.length) % flatItems.length;
          });
          return true;
        }
        if (event.key === "Enter") {
          select(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    return (
      <SuggestionMenuTransition
        className={cn("relative w-[26rem]", FLOATING_GLASS_BACKDROP_CLASS)}
        exiting={exiting}
        onExitComplete={onExitComplete}
      >
        <div
          className={cn(
            "relative z-10 overflow-hidden rounded-lg text-popover-foreground shadow-2xl",
            GLASS_FRAME_CLASS,
          )}
        >
          <div className="relative z-10 overflow-hidden rounded-b-lg border-b border-border bg-background">
            {showScopeControls || showSearching ? (
              <div className="flex items-center gap-1 border-b border-border/60 p-1.5">
                {showScopeControls
                  ? ([undefined, "note", "color"] as const).map((scope) => (
                      <button
                        key={scope ?? "all"}
                        type="button"
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                          parsed.scope === scope && "bg-accent text-foreground",
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setScope(scope)}
                      >
                        {scope === "note"
                          ? "Notes"
                          : scope === "color"
                            ? "Colors"
                            : "All"}
                      </button>
                    ))
                  : null}
                {showSearching ? (
                  <span
                    className="ml-auto pr-1 text-[10px] text-muted-foreground/75"
                    aria-live="polite"
                  >
                    Searching…
                  </span>
                ) : null}
              </div>
            ) : null}
            <div
              className="max-h-80 [scrollbar-width:none] overflow-y-auto p-1.5 [&::-webkit-scrollbar]:hidden"
              role="listbox"
              aria-label="Mention an asset"
              aria-busy={loading}
            >
              {showInitialLoading ? <MentionMenuSkeleton /> : null}
              {notes.length > 0 && parsed.scope !== "color" ? (
                <MentionGroup
                  label="Notes"
                  showLabel={showGroupLabels}
                  items={notes}
                  startIndex={0}
                  selectedIndex={selectedIndex}
                  itemRefs={itemRefs}
                  onSelect={select}
                  onHover={setSelectedIndex}
                />
              ) : null}
              {colors.length > 0 && parsed.scope !== "note" ? (
                <MentionGroup
                  label="Colors"
                  showLabel={showGroupLabels}
                  items={colors}
                  startIndex={parsed.scope === "color" ? 0 : notes.length}
                  selectedIndex={selectedIndex}
                  itemRefs={itemRefs}
                  onSelect={select}
                  onHover={setSelectedIndex}
                />
              ) : null}
              {flatItems.length === 0 && !showInitialLoading ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground/75">
                  {emptyLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="relative z-0 flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-1.5 text-[10px] leading-4 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Kbd variant="solid" className="h-4 min-w-fit px-1 text-[10px]">
                @note
              </Kbd>
              <span>or</span>
              <Kbd variant="solid" className="h-4 min-w-fit px-1 text-[10px]">
                @color
              </Kbd>
              <span>to filter</span>
            </span>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <KbdGroup className="gap-0.5">
                  <Kbd
                    variant="solid"
                    className="h-4 min-w-4 px-0.5 text-[10px]"
                  >
                    <ArrowUpIcon />
                  </Kbd>
                  <Kbd
                    variant="solid"
                    className="h-4 min-w-4 px-0.5 text-[10px]"
                  >
                    <ArrowDownIcon />
                  </Kbd>
                </KbdGroup>
                <span>to navigate</span>
              </span>
              <span className="ml-3 inline-flex items-center gap-1">
                <Kbd variant="solid" className="h-4 min-w-4 px-0.5 text-[10px]">
                  <CornerDownLeftIcon />
                </Kbd>
                <span>to insert</span>
              </span>
            </div>
          </div>
        </div>
      </SuggestionMenuTransition>
    );
  },
);

function MentionMenuSkeleton() {
  return (
    <div className="space-y-1 p-0.5" aria-label="Loading mentions">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2">
          <span className="size-7 shrink-0 animate-pulse rounded-md bg-muted" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="h-3 w-2/5 animate-pulse rounded bg-muted" />
            <span className="h-2.5 w-3/5 animate-pulse rounded bg-muted" />
          </span>
          <span className="h-2.5 w-14 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function MentionGroup({
  label,
  showLabel,
  items,
  startIndex,
  selectedIndex,
  itemRefs,
  onSelect,
  onHover,
}: {
  label: string;
  showLabel: boolean;
  items: NoteMentionTarget[];
  startIndex: number;
  selectedIndex: number;
  itemRefs: React.RefObject<Map<number, HTMLButtonElement>>;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div>
      {showLabel ? (
        <p className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground first:pt-1">
          {label}
        </p>
      ) : null}
      {items.map((item, offset) => {
        const index = startIndex + offset;
        return (
          <button
            key={`${item.assetType}:${item.assetId}`}
            ref={(element) => {
              if (element) itemRefs.current?.set(index, element);
              else itemRefs.current?.delete(index);
            }}
            type="button"
            role="option"
            aria-selected={selectedIndex === index}
            className={cn(
              "grid w-full grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,7rem)] items-center gap-x-3 rounded-lg px-2 py-2 text-left",
              selectedIndex === index ? "bg-accent" : "hover:bg-accent/60",
            )}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(index)}
          >
            {item.assetType === "color" ? (
              <span
                className="size-7 rounded-md"
                style={{
                  background: item.gradient
                    ? gradientToCss(
                        item.gradient.stops ?? [
                          { color: item.gradient.from, position: 0 },
                          { color: item.gradient.to, position: 100 },
                        ],
                        item.gradient.type ?? "linear",
                        item.gradient.angle,
                      )
                    : (item.hex ?? "var(--muted)"),
                }}
              />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-md bg-muted">
                <FileTextIcon className="size-5 text-foreground/80" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {item.label}
              </span>
              {item.snippet ? (
                <span className="block truncate text-xs text-muted-foreground">
                  {item.snippet}
                </span>
              ) : null}
            </span>
            <span className="justify-self-end truncate text-right text-[11px] text-muted-foreground/75">
              {item.locationLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function createMentionsExtension({
  workspaceSlug,
  sourceAssetId,
  queryClient,
}: {
  workspaceSlug: string;
  sourceAssetId?: number;
  queryClient?: QueryClient;
}) {
  const recentInput: MentionSearchInput = {
    q: "",
    limit: RECENT_MENTION_LIMIT,
    sourceAssetId,
  };
  const searchInput = (query: string): MentionSearchInput => {
    const parsed = parseMentionQuery(query);
    return {
      q: parsed.search,
      types: parsed.scope ? [parsed.scope] : undefined,
      limit: parsed.search ? undefined : RECENT_MENTION_LIMIT,
      sourceAssetId,
    };
  };

  return Extension.create({
    name: "mentions",
    addProseMirrorPlugins() {
      return [
        Suggestion<NoteMentionTarget, NoteMentionTarget>({
          editor: this.editor,
          pluginKey: mentionSuggestionPluginKey,
          char: "@",
          allowSpaces: true,
          startOfLine: false,
          allow: ({ state, range: mentionRange }) => {
            const $from = state.doc.resolve(mentionRange.from);
            return !$from.parent.type.spec.code;
          },
          shouldShow: ({ query }) => shouldShowMentionSuggestion(query),
          items: async ({ query, signal }) => {
            const parsed = parseMentionQuery(query);
            const input = searchInput(query);
            const options = mentionSearchQueryOptions(workspaceSlug, input);
            const cached = queryClient?.getQueryData(options.queryKey);
            const isFresh = queryClient
              ? isMentionSearchCacheFresh(queryClient, options.queryKey)
              : false;
            if (cached && isFresh) return cached.targets;

            if (parsed.search) await waitForMentionSearch(signal);
            const result = queryClient
              ? await queryClient.fetchQuery(options)
              : await searchNoteMentions(workspaceSlug, input, signal);
            return result.targets;
          },
          command: ({ editor, range, props }) =>
            insertMention(editor, range, props),
          render: () => {
            let renderer:
              | ReactRenderer<MentionMenuHandle, MentionMenuProps>
              | undefined;
            let unmount: (() => void) | undefined;
            let latestProps: MentionMenuProps | undefined;
            let exitTimer: number | undefined;
            const cleanup = () => {
              if (exitTimer !== undefined) window.clearTimeout(exitTimer);
              exitTimer = undefined;
              unmount?.();
              renderer?.destroy();
              renderer = undefined;
              unmount = undefined;
              latestProps = undefined;
            };
            const withCachedItems = (
              props: SuggestionProps<NoteMentionTarget, NoteMentionTarget>,
            ): MentionMenuProps => {
              const parsed = parseMentionQuery(props.query);
              const options = mentionSearchQueryOptions(
                workspaceSlug,
                searchInput(props.query),
              );
              const exactCached = queryClient?.getQueryData(options.queryKey);
              const exactCacheIsFresh = queryClient
                ? isMentionSearchCacheFresh(queryClient, options.queryKey)
                : false;
              const recentCached = queryClient?.getQueryData(
                mentionSearchQueryOptions(workspaceSlug, recentInput).queryKey,
              );
              const cachedItems =
                exactCached?.targets ??
                (recentCached
                  ? filterRecentMentionTargets(recentCached.targets, parsed)
                  : undefined);
              return {
                ...props,
                cachedItems,
                isSearchPending:
                  Boolean(parsed.search) && props.loading && !exactCacheIsFresh,
                exiting: false,
                onExitComplete: cleanup,
              };
            };
            return {
              onStart: (props) => {
                cleanup();
                latestProps = withCachedItems(props);
                renderer = new ReactRenderer(MentionMenu, {
                  editor: props.editor,
                  props: latestProps,
                });
                renderer.element.style.zIndex = "80";
                unmount = props.mount(renderer.element);
              },
              onUpdate: (props) => {
                if (!renderer) return;
                latestProps = withCachedItems(props);
                renderer.updateProps(latestProps);
              },
              onKeyDown: (props) => renderer?.ref?.onKeyDown(props) ?? false,
              onExit: () => {
                if (!renderer || !latestProps || latestProps.exiting) return;
                latestProps = { ...latestProps, exiting: true };
                renderer.updateProps(latestProps);
                exitTimer = window.setTimeout(
                  cleanup,
                  SUGGESTION_MENU_EXIT_FALLBACK_MS,
                );
              },
            };
          },
        }),
      ];
    },
  });
}

export function shouldShowMentionSuggestion(query: string) {
  return !query.startsWith(" ");
}

function insertMention(
  editor: Editor,
  range: Range,
  target: NoteMentionTarget,
) {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent([
      {
        type: "assetMention",
        attrs: {
          targetAssetId: target.assetId,
          assetType: target.assetType,
          fallbackLabel: escapeMentionLabel(target.label),
        },
      },
      { type: "text", text: " " },
    ])
    .run();
}

export function parseMentionQuery(query: string): {
  scope?: NoteMentionType;
  search: string;
} {
  const match = /^(note|color)(?:\s+(.*))?$/i.exec(query);
  if (!match) return { search: query.trim() };
  return {
    scope: match[1]!.toLowerCase() as NoteMentionType,
    search: (match[2] ?? "").trim(),
  };
}

export function createMentionScopeQuery(
  scope: NoteMentionType | undefined,
  query: string,
): string {
  const { search } = parseMentionQuery(query);
  return `@${scope ? `${scope} ` : ""}${search}`;
}

export function parseNumericAssetId(assetId?: string): number | undefined {
  if (!assetId) return undefined;
  const match = /^(?:note|color)-(\d+)$/.exec(assetId);
  return match ? Number(match[1]) : undefined;
}

function escapeMentionLabel(label: string) {
  return (
    label
      .trim()
      .replace(/[\\\]]/g, "_")
      .slice(0, 255) || "Untitled"
  );
}

function waitForMentionSearch(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(resolve, 140);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("Mention search aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
