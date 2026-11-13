import "./note-highlight-colors.css";
import "./note-rich-text.css";

import { useQueryClient } from "@tanstack/react-query";
import { type Editor } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import { PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { NoteCodeBlockEditing } from "@/components/board/note-editor/code-block/note-code-block-editing";
import { NoteCutListItemCleanup } from "@/components/board/note-editor/blocks/note-cut-cleanup";
import {
  clearNoteAgentDraft,
  loadNoteAgentDraft,
  saveNoteAgentDraft,
} from "@/components/board/note-editor/agent/note-agent-draft-store";
import {
  NoteAgentPrompt,
  type NoteAgentDraft,
} from "@/components/board/note-editor/agent/note-agent-prompt";
import {
  isNoteAgentSessionActive,
  NoteAgentSession,
  noteAgentSessionBlockIndex,
  noteMarkdownWithoutAgentDraft,
  selectionOverlapsNoteAgentDraft,
  startNoteAgentRewrite,
  startNoteAgentSession,
  startNoteAgentSessionAtBlock,
} from "@/components/board/note-editor/agent/note-agent-session";
import {
  AssetMention,
  createMentionsExtension,
  NoteMentionProvider,
  parseNumericAssetId,
  type OpenNoteMentionTarget,
} from "@/components/board/note-editor/mentions/note-mentions";
import { NoteMermaidBlock } from "@/components/board/note-editor/mermaid/note-mermaid-block";
import { NoteTableActiveCell } from "@/components/board/note-editor/tables/note-table-active-cell";
import { NoteTableControls } from "@/components/board/note-editor/tables/note-table-controls";
import { NoteTableView } from "@/components/board/note-editor/tables/note-table-view";
import {
  getMarkdownPaste,
  normalizeMarkdownBlocks,
} from "@/components/board/note-editor/markdown/note-markdown-paste";
import { NotePreviewRail } from "@/components/board/note-preview-rail";
import { MnemeeTaskItem } from "@/components/board/task-item";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseMermaidFence } from "@/lib/diagram";
import { cn } from "@/lib/utils";

import {
  mentionSearchQueryOptions,
  RECENT_MENTION_LIMIT,
} from "@/api/note-mentions/hooks";
import { type NoteHighlightColor } from "@/lib/note-highlights";

import { createBlockDragHandleExtension } from "./note-editor/blocks/note-block-drag-handle";
import { NoteCodeBlock } from "./note-editor/code-block/note-code-block";
import { InlineFormattingMenu } from "./note-editor/formatting/note-formatting-menu";
import { NoteHighlight } from "./note-editor/highlight/note-highlight";
import {
  hasHighlightInSelection,
  replaceHighlight,
} from "./note-editor/highlight/note-highlight-selection";
import { LinkInteractionPopover } from "./note-editor/links/note-link-popover";
import { SlashCommands } from "./note-editor/slash-commands/note-slash-commands";

export type NoteRichTextHandle = {
  getMarkdown: () => string;
  applyHighlight: (color: NoteHighlightColor) => string | undefined;
  removeHighlight: () => string | undefined;
  restoreMarkdown: (markdown: string) => void;
  focus: () => void;
};

const noteLowlight = createLowlight(common);

const NON_RICH_TEXT_WIDGET_SELECTOR = [
  ".note-code-block",
  "[data-type='mermaid-block']",
  ".note-task-checkbox",
  ".note-asset-mention",
  ".column-resize-handle",
  "hr",
].join(", ");

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

function docEnd(editor: Editor) {
  return editor.state.doc.content.size;
}

// Built per editor instance because each DragHandle extension owns its own
// floating controls DOM and hover target state.
function createBaseNoteExtensions(
  blockDragHandle: ReturnType<
    typeof createBlockDragHandleExtension
  >["extension"],
) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      dropcursor: { color: "var(--primary)", width: 2 },
      underline: false,
      link: {
        autolink: true,
        openOnClick: false,
        HTMLAttributes: {
          class: "cursor-pointer",
          rel: "noopener noreferrer",
          target: "_blank",
        },
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
    NoteCodeBlockEditing,
    NoteMermaidBlock,
    TableKit.configure({ table: { resizable: true, View: NoteTableView } }),
    NoteTableActiveCell,
    TaskList,
    MnemeeTaskItem.configure({ nested: true }),
    NoteCutListItemCleanup,
    NoteHighlight,
    Image.configure({
      allowBase64: false,
      HTMLAttributes: { class: "note-image" },
    }),
    Placeholder.configure({
      // Notes can intentionally start with a blank paragraph. Only show the
      // prompt for the paragraph containing the caret so a blank first line
      // does not display a second placeholder while the editor is focused at
      // the end of the note.
      showOnlyCurrent: true,
      placeholder: ({ editor, node, pos }) => {
        if (node.type.name === "heading") {
          return `Heading ${node.attrs.level}`;
        }
        // Space opens the agent only on a top-level line, so only hint it there.
        // '@' mentions are a convention users already expect, so the hint
        // stays short by leaving them out.
        const topLevel = editor.state.doc.resolve(pos).depth === 0;
        return topLevel
          ? "Press space for AI or '/' for blocks…"
          : "Type '/' for blocks…";
      },
    }),
    Markdown.configure({
      markedOptions: { gfm: true, breaks: false },
    }),
    SlashCommands,
    blockDragHandle,
  ];
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
  // The open agent session's widget (where its controls render) and, when it was
  // reopened from storage, the draft it resumes.
  const [agentSession, setAgentSession] = useState<{
    widget: HTMLElement;
    restored?: NoteAgentDraft;
  } | null>(null);
  const agentWidget = agentSession?.widget ?? null;
  // Which note the session belongs to and its latest finished draft, kept so
  // the stored copy can follow edits made elsewhere in the note.
  const agentSessionNoteIdRef = useRef<string | undefined>(undefined);
  const agentPendingDraftRef = useRef<NoteAgentDraft | null>(null);
  const agentRestoredForRef = useRef<string | undefined>(undefined);
  const lastSessionSaveRef = useRef<string | null>(null);
  const sourceNoteIdRef = useRef(sourceNoteId);
  sourceNoteIdRef.current = sourceNoteId;
  const persistAgentDraft = useCallback((currentEditor: Editor) => {
    const noteId = agentSessionNoteIdRef.current;
    const pending = agentPendingDraftRef.current;
    const blockIndex = noteAgentSessionBlockIndex(currentEditor.state);
    if (!noteId || !pending || blockIndex === null) return;
    saveNoteAgentDraft(noteId, {
      baseMarkdown: noteMarkdownWithoutAgentDraft(currentEditor),
      blockIndex,
      draft: pending.draft,
      request: pending.request,
      savedAt: Date.now(),
    });
  }, []);
  const persistAgentDraftRef = useRef(persistAgentDraft);
  persistAgentDraftRef.current = persistAgentDraft;
  // Opens the agent on the current selection to rewrite it.
  const startAgentRewrite = useCallback((currentEditor: Editor) => {
    if (isNoteAgentSessionActive(currentEditor.state)) return false;
    const widget = document.createElement("div");
    widget.className = "note-agent-widget";
    widget.contentEditable = "false";
    if (!startNoteAgentRewrite(currentEditor, widget)) return false;
    agentSessionNoteIdRef.current = sourceNoteIdRef.current;
    agentPendingDraftRef.current = null;
    lastSessionSaveRef.current = null;
    setAgentSession({ widget });
    return true;
  }, []);
  const startAgentRewriteRef = useRef(startAgentRewrite);
  startAgentRewriteRef.current = startAgentRewrite;
  const initialMarkdownRef = useRef(markdown);
  onChangeRef.current = onChange;
  onSaveShortcutRef.current = onSaveShortcut;
  editableRef.current = editable;
  highlightColorRef.current = highlightColor;
  highlightModeRef.current = highlightMode;
  onHighlightModeChangeRef.current = onHighlightModeChange;
  onHighlightSelectionChangeRef.current = onHighlightSelectionChange;
  const sourceAssetId = parseNumericAssetId(sourceNoteId);
  const queryClient = useQueryClient();
  const blockControls = useMemo(createBlockDragHandleExtension, []);
  const noteExtensions = useMemo(
    () => [
      ...createBaseNoteExtensions(blockControls.extension),
      AssetMention,
      NoteAgentSession,
      ...(workspaceSlug
        ? [
            createMentionsExtension({
              workspaceSlug,
              sourceAssetId,
              queryClient,
            }),
          ]
        : []),
    ],
    [blockControls, queryClient, sourceAssetId, workspaceSlug],
  );

  useEffect(() => {
    if (!workspaceSlug) return;
    void queryClient.prefetchQuery(
      mentionSearchQueryOptions(workspaceSlug, {
        q: "",
        limit: RECENT_MENTION_LIMIT,
        sourceAssetId,
      }),
    );
  }, [queryClient, sourceAssetId, workspaceSlug]);

  const noteBubbleMenuKey = useMemo(() => new PluginKey("noteBubbleMenu"), []);

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "note-rich-text-content min-h-full outline-none",
        spellcheck: "false",
      },
      handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
        const currentEditor = editorInstanceRef.current;
        // Ctrl/Cmd+J asks the agent to edit the selection.
        if (
          editableRef.current &&
          currentEditor &&
          (event.ctrlKey || event.metaKey) &&
          !event.altKey &&
          !event.shiftKey &&
          event.key.toLowerCase() === "j" &&
          !currentEditor.state.selection.empty
        ) {
          event.preventDefault();
          startAgentRewriteRef.current(currentEditor);
          return true;
        }
        if (
          editableRef.current &&
          !highlightModeRef.current &&
          event.key === " " &&
          !event.repeat &&
          !event.isComposing &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          currentEditor?.state.selection.empty &&
          !isNoteAgentSessionActive(currentEditor.state) &&
          currentEditor.state.selection.$from.depth === 1 &&
          currentEditor.state.selection.$from.parent.type.name ===
            "paragraph" &&
          currentEditor.state.selection.$from.parent.content.size === 0
        ) {
          event.preventDefault();
          const widget = document.createElement("div");
          widget.className = "note-agent-widget";
          widget.contentEditable = "false";
          if (startNoteAgentSession(currentEditor, widget)) {
            agentSessionNoteIdRef.current = sourceNoteIdRef.current;
            agentPendingDraftRef.current = null;
            lastSessionSaveRef.current = null;
            setAgentSession({ widget });
          }
          return true;
        }
        if (event.key === "Escape" && highlightModeRef.current) {
          event.preventDefault();
          highlightPointerDownRef.current = false;
          onHighlightModeChangeRef.current?.(false);
          return true;
        }
        if (event.key === "Escape") {
          const currentEditor = editorInstanceRef.current;
          if (currentEditor && !currentEditor.state.selection.empty) {
            event.preventDefault();
            event.stopPropagation();
            currentEditor.commands.setTextSelection(
              currentEditor.state.selection.to,
            );
            return true;
          }
        }
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          onSaveShortcutRef.current?.();
          return true;
        }
        return false;
      },
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        if (!editableRef.current) return false;
        const currentEditor = editorInstanceRef.current;
        if (!currentEditor || !event.clipboardData) return false;
        const source = parseMermaidFence(
          event.clipboardData.getData("text/plain"),
        );
        if (source !== undefined && !currentEditor.isActive("codeBlock")) {
          event.preventDefault();
          currentEditor
            .chain()
            .focus()
            .insertContent({ type: "mermaidBlock", attrs: { source } })
            .run();
          return true;
        }
        if (currentEditor.isActive("codeBlock")) return false;
        const markdown = getMarkdownPaste(event.clipboardData);
        if (!markdown) return false;
        const parser = new MarkdownManager({
          extensions: currentEditor.extensionManager.baseExtensions,
          markedOptions: { gfm: true, breaks: false },
        });
        const parsed = normalizeMarkdownBlocks(
          parser.parse(markdown),
          currentEditor.schema,
        );
        const inserted = currentEditor.commands.insertContent(
          parsed.content ?? [],
        );
        if (!inserted) return false;
        event.preventDefault();
        return true;
      },
      handleDOMEvents: {
        mousedown: (_view: unknown, event: Event) => {
          const target = event.target;
          const isNonRichTextWidget =
            target instanceof Element &&
            Boolean(target.closest(NON_RICH_TEXT_WIDGET_SELECTOR));
          const currentEditor = editorInstanceRef.current;

          // Node views can take focus without replacing the previous
          // TextSelection. Clear that stale selection before the browser
          // processes the click, otherwise the formatting menu remains pinned
          // to text the user is no longer interacting with.
          if (
            isNonRichTextWidget &&
            currentEditor &&
            !currentEditor.state.selection.empty
          ) {
            currentEditor.view.dispatch(
              currentEditor.state.tr
                .setSelection(
                  TextSelection.near(
                    currentEditor.state.doc.resolve(
                      currentEditor.state.selection.to,
                    ),
                  ),
                )
                .setMeta(noteBubbleMenuKey, "hide")
                .setMeta("addToHistory", false),
            );
          }

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
        if (highlightModeRef.current) return false;
        const target = event.target;
        const anchor =
          target instanceof Element ? target.closest("a[href]") : null;
        const href = anchor?.getAttribute("href");
        if (!href) return false;
        window.open(href, "_blank", "noopener,noreferrer");
        return true;
      },
    }),
    [noteBubbleMenuKey],
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
      if (isNoteAgentSessionActive(currentEditor.state)) {
        // A pending agent draft is not part of the note until it is kept: save
        // the note around it, and only when that actually changed (streaming
        // updates the draft many times without touching the rest).
        const saved = noteMarkdownWithoutAgentDraft(currentEditor);
        if (saved === lastSessionSaveRef.current) return;
        lastSessionSaveRef.current = saved;
        persistAgentDraftRef.current(currentEditor);
        onChangeRef.current?.(saved);
        return;
      }
      lastSessionSaveRef.current = null;
      onChangeRef.current?.(currentEditor.getMarkdown());
    },
    editorProps,
  });
  editorInstanceRef.current = editor;

  useEffect(() => {
    if (!editor) return;

    let pointer: { x: number; y: number } | undefined;
    let pointerAtScroll: { x: number; y: number } | undefined;
    let suppressed = false;

    const isBetweenListItems = (event: MouseEvent) => {
      if (
        !(event.target instanceof Element) ||
        !editor.view.dom.contains(event.target)
      )
        return false;

      const list = event.target.closest("ul, ol");
      if (!list || !editor.view.dom.contains(list)) return false;

      const lists = [list, ...list.querySelectorAll("ul, ol")];
      const hoveredList = lists.findLast((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return event.clientY >= rect.top && event.clientY < rect.bottom;
      });
      if (!hoveredList) return false;

      return !Array.from(hoveredList.children).some((child) => {
        if (!child.matches("li")) return false;
        const rect = child.getBoundingClientRect();
        return event.clientY >= rect.top && event.clientY < rect.bottom;
      });
    };

    const onScroll = (event: Event) => {
      const scrollTarget = event.target;
      if (
        scrollTarget instanceof Node &&
        scrollTarget !== document &&
        !scrollTarget.contains(editor.view.dom)
      )
        return;

      suppressed = true;
      pointerAtScroll = pointer;
      blockControls.controls.dataset.scrollSuppressed = "true";
      blockControls.clearAltGuard();
      editor.commands.setMeta("hideDragHandle", true);
    };

    const onMouseMove = (event: MouseEvent) => {
      const moved =
        pointerAtScroll &&
        (event.clientX !== pointerAtScroll.x ||
          event.clientY !== pointerAtScroll.y);
      pointer = { x: event.clientX, y: event.clientY };
      if (!suppressed) {
        // A nested list's vertical gap belongs to its outer list item in the
        // document tree. Keep the previous target until an actual item is hit.
        if (isBetweenListItems(event)) event.stopPropagation();
        return;
      }
      if (!moved) {
        pointerAtScroll ??= pointer;
        if (
          event.target instanceof Node &&
          editor.view.dom.contains(event.target)
        ) {
          event.stopPropagation();
        }
        return;
      }
      suppressed = false;
      editor.commands.setMeta("hideDragHandle", true);
      delete blockControls.controls.dataset.scrollSuppressed;
    };

    const rememberPointer = (event: MouseEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
    };

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("mousedown", rememberPointer, true);
    document.addEventListener("wheel", rememberPointer, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("mousedown", rememberPointer, true);
      document.removeEventListener("wheel", rememberPointer, true);
      window.removeEventListener("scroll", onScroll, true);
      delete blockControls.controls.dataset.scrollSuppressed;
      blockControls.clearAltGuard();
    };
  }, [editor, blockControls]);

  useEffect(() => {
    editor?.setEditable(editable, false);
  }, [editable, editor]);

  useEffect(() => {
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
    // Compare against the note as saved: while an agent draft is pending the
    // parent holds the note without it, which is not a change to apply.
    if (!editor || noteMarkdownWithoutAgentDraft(editor) === markdown) return;
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

  useEffect(() => {
    if (!editor || !agentWidget) return;
    // The session can end from inside the prompt (keep/discard) or from
    // outside it (content replaced); either way the prompt unmounts.
    const closeEndedSession = () => {
      if (isNoteAgentSessionActive(editor.state)) return;
      agentPendingDraftRef.current = null;
      lastSessionSaveRef.current = null;
      setAgentSession(null);
    };
    editor.on("transaction", closeEndedSession);
    return () => {
      editor.off("transaction", closeEndedSession);
    };
  }, [agentWidget, editor]);

  // Reopen a draft stored on an earlier visit, but only onto the exact note it
  // was written against; otherwise it stays stored until it expires.
  useEffect(() => {
    if (!editor || !editable || !sourceNoteId || agentWidget) return;
    if (agentRestoredForRef.current === sourceNoteId) return;
    if (isNoteAgentSessionActive(editor.state)) return;
    const stored = loadNoteAgentDraft(sourceNoteId);
    if (!stored) {
      agentRestoredForRef.current = sourceNoteId;
      return;
    }
    if (stored.baseMarkdown !== editor.getMarkdown()) return;
    agentRestoredForRef.current = sourceNoteId;
    const widget = document.createElement("div");
    widget.className = "note-agent-widget";
    widget.contentEditable = "false";
    if (!startNoteAgentSessionAtBlock(editor, stored.blockIndex, widget)) {
      clearNoteAgentDraft(sourceNoteId);
      return;
    }
    const restored = { draft: stored.draft, request: stored.request };
    agentSessionNoteIdRef.current = sourceNoteId;
    agentPendingDraftRef.current = restored;
    lastSessionSaveRef.current = stored.baseMarkdown;
    setAgentSession({ widget, restored });
    // Re-runs when markdown changes; it is not read inside the effect.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [agentWidget, editable, editor, markdown, sourceNoteId]);

  const handleAgentDraft = useCallback(
    (draft: NoteAgentDraft) => {
      agentPendingDraftRef.current = draft;
      if (editor) persistAgentDraft(editor);
    },
    [editor, persistAgentDraft],
  );
  const handleAgentResolve = useCallback(() => {
    agentPendingDraftRef.current = null;
    if (agentSessionNoteIdRef.current) {
      clearNoteAgentDraft(agentSessionNoteIdRef.current);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      // Callers save or copy this, so a pending agent draft is left out.
      getMarkdown: () =>
        editor ? noteMarkdownWithoutAgentDraft(editor) : markdown,
      applyHighlight: (color) => {
        if (!editor || editor.state.selection.empty) return undefined;
        replaceHighlight(editor, color);
        return noteMarkdownWithoutAgentDraft(editor);
      },
      removeHighlight: () => {
        if (!editor || editor.state.selection.empty) return undefined;
        editor.chain().focus().unsetHighlight().run();
        return noteMarkdownWithoutAgentDraft(editor);
      },
      restoreMarkdown: (nextMarkdown) => {
        editor?.commands.setContent(nextMarkdown, {
          contentType: "markdown",
          emitUpdate: false,
        });
      },
      focus: () => {
        if (!editor) return;
        focusFirstNewLine(editor);
      },
    }),
    [editor, markdown],
  );

  const [blockStyleMenuOpen, setBlockStyleMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // The menu keeps focus while it is being used: opening a popup moves focus
  // into a portal, and closing one hands it back to a button in the menu.
  const barOwnsFocus = useCallback(() => {
    const bar = barRef.current;
    const active = document.activeElement;
    return Boolean(bar && active && bar.contains(active));
  }, []);

  const shouldShowBubbleMenu = useCallback(
    ({ editor: currentEditor }: { state: EditorState; editor: Editor }) =>
      (currentEditor.isFocused || blockStyleMenuOpen || barOwnsFocus()) &&
      !highlightMode &&
      currentEditor.state.selection instanceof TextSelection &&
      // The plugin hands over the state from before the transaction it is
      // reacting to, so the emptiness check has to read the live selection.
      // Otherwise the first transaction of a fresh selection is judged against
      // the empty selection it replaced and the menu never appears.
      !currentEditor.state.selection.empty &&
      !currentEditor.isActive("codeBlock") &&
      // Formatting a pending agent draft would be overwritten by keep or a
      // follow-up; it becomes editable once kept.
      !selectionOverlapsNoteAgentDraft(currentEditor.state),
    [barOwnsFocus, blockStyleMenuOpen, highlightMode],
  );

  const dismissSelection = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { state, view } = editor;
    if (state.selection.empty) return;
    view.dispatch(
      state.tr
        .setSelection(TextSelection.near(state.doc.resolve(state.selection.to)))
        .setMeta(noteBubbleMenuKey, "hide")
        .setMeta("addToHistory", false),
    );
  }, [editor, noteBubbleMenuKey]);

  // Closing the popup on its own leaves the selection and the menu alone, so the
  // popup can be opened again without re-selecting anything.
  const handleBlockStyleOpenChange = useCallback((open: boolean) => {
    setBlockStyleMenuOpen(open);
  }, []);

  useEffect(() => {
    if (!blockStyleMenuOpen) return;
    // The first Escape belongs to the popup: it closes the popup and leaves the
    // selection mounted, and the enclosing note surface must not read the press
    // as a request to close the note. The next Escape is the app's own, and it
    // drops the selection and the menu.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat) return;
      event.preventDefault();
      event.stopPropagation();
      setBlockStyleMenuOpen(false);
      editor?.commands.focus();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [blockStyleMenuOpen, editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // Clicking away is the other way to drop the selection: leaving the editor,
    // its menu and any open popup behind means there is nothing left to act on
    // the selection, so it goes with the menu.
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (editor.view.dom.contains(target)) return;
      if (target.closest("[data-note-bubble-menu]")) return;
      if (target.closest("[data-base-ui-portal]")) return;
      dismissSelection();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [editor, dismissSelection]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // The bubble menu plugin only re-evaluates `shouldShow` on editor
    // transactions and on editor focus/blur. Anything that moves focus to a
    // popup outside the editor (the block style popup, highlight mode) leaves
    // its last decision in place, so re-assert it whenever those inputs change.
    const view = editor.view;
    const assert = (value: "show" | "hide") =>
      view.dispatch(
        view.state.tr
          .setMeta(noteBubbleMenuKey, value)
          .setMeta("addToHistory", false),
      );
    if (
      !(editor.state.selection instanceof TextSelection) ||
      editor.state.selection.empty ||
      editor.isActive("codeBlock") ||
      highlightMode
    ) {
      assert("hide");
      return;
    }
    // Focus on its own must never hide the menu. Closing a popup hands focus
    // over for a moment before it lands back on the editor or on a button in the
    // menu, and hiding on the way through unmounts and remounts the menu in the
    // middle of one press. The plugin settles where the focus really ended up.
    if (editor.isFocused || blockStyleMenuOpen || barOwnsFocus())
      assert("show");
  }, [
    editor,
    noteBubbleMenuKey,
    blockStyleMenuOpen,
    highlightMode,
    barOwnsFocus,
  ]);

  if (!editor) return null;

  return (
    <NoteMentionProvider
      editor={editor}
      workspaceSlug={workspaceSlug}
      sourceAssetId={sourceAssetId}
      onOpen={onOpenMention}
    >
      {createPortal(
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="note-block-add-button"
                aria-label="Add block below; Alt-click to add above"
                onClick={(event) => blockControls.addBlock(event.altKey)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </button>
            }
          />
          <TooltipContent className="block space-y-1 text-center">
            <div>
              <span className="font-semibold">Click</span>
              <span className="text-background/75"> to add below</span>
            </div>
            <div>
              <span className="font-semibold">Alt-Click</span>
              <span className="text-background/75"> to add above</span>
            </div>
          </TooltipContent>
        </Tooltip>,
        blockControls.addButtonMount,
      )}
      {createPortal(
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                draggable
                data-drag-handle=""
                aria-label="Drag block to move"
                className="note-block-drag-button"
              >
                <svg
                  viewBox="6 2 12 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="9" cy="5" r="1" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="15" cy="5" r="1" />
                  <circle cx="15" cy="19" r="1" />
                </svg>
              </button>
            }
          />
          <TooltipContent className="transition-none">
            <span className="font-semibold">Drag</span>
            <span className="text-background/75"> to move</span>
          </TooltipContent>
        </Tooltip>,
        blockControls.dragButtonMount,
      )}
      {editable ? (
        <>
          <BubbleMenu
            editor={editor}
            pluginKey={noteBubbleMenuKey}
            className="z-[80]"
            options={{ placement: "top", offset: 8 }}
            shouldShow={shouldShowBubbleMenu}
          >
            <InlineFormattingMenu
              editor={editor}
              onExtractSelection={onExtractSelection}
              onAskAgent={() => startAgentRewrite(editor)}
              blockStyleMenuOpen={blockStyleMenuOpen}
              onBlockStyleMenuOpenChange={handleBlockStyleOpenChange}
              menuRef={barRef}
            />
          </BubbleMenu>
          <LinkInteractionPopover editor={editor} />
          <NoteTableControls editor={editor} />
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
      {agentWidget
        ? // Rendered eagerly (not lazy) so the input exists before the next
          // keystroke after space; typing that lands earlier is swallowed.
          createPortal(
            <NoteAgentPrompt
              editor={editor}
              restored={agentSession?.restored}
              onDraft={handleAgentDraft}
              onResolve={handleAgentResolve}
              workspaceSlug={workspaceSlug}
              sourceAssetId={sourceAssetId}
            />,
            agentWidget,
          )
        : null}
    </NoteMentionProvider>
  );
});
