import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { useCreateInboxNote, useCreateNote } from "@/api/collection";
import type {
  BoardInsertionPlacement,
  CollectionNoteNode,
} from "@/api/collection";
import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import { persistNoteDrawer } from "@/components/board/use-persisted-note-drawer";
import { NoteEditorLoading } from "@/components/board/note-editor-loading";
import {
  NoteWorkspace,
  NoteWorkspaceContent,
  NoteWorkspaceTitle,
  NoteWorkspaceTrigger,
} from "@/components/board/note-workspace-dialog";
import { Button } from "@/components/ui/button";
import {
  clearCreateNoteDraft,
  getCreateNoteDraftId,
  loadCreateNoteDraft,
  saveCreateNoteDraft,
} from "@/lib/create-note-draft";
import { composeFrontMatter, parseFrontMatter } from "@/lib/front-matter";
import { collectionNodeToAsset } from "@/lib/asset-transform";

const CREATE_DELAY_MS = 700;
const NoteRichText = lazy(() =>
  import("@/components/board/note-rich-text").then((module) => ({
    default: module.NoteRichText,
  })),
);

export function CreateNoteDialog({
  workspaceSlug,
  collectionPath,
  children,
  open: controlledOpen,
  onOpenChange,
  initialContent = "",
  restoreOpen = false,
  target = "collection",
  placement,
}: {
  workspaceSlug: string;
  collectionPath: string;
  children?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialContent?: string;
  restoreOpen?: boolean;
  target?: "collection" | "inbox";
  placement?: BoardInsertionPlacement;
}) {
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const createNote = useCreateNote(workspaceSlug, collectionSlug);
  const createInboxNote = useCreateInboxNote(workspaceSlug);
  const navigate = useNavigate();
  const editorRef = useRef<NoteRichTextHandle>(null);
  const hasRestoredOpenRef = useRef(false);
  const isInitialPageReloadRef = useRef(isPageReload());
  const failedContentRef = useRef<string | undefined>(undefined);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const frontMatter = useMemo(() => parseFrontMatter(content), [content]);
  const draftId = useMemo(
    () => getCreateNoteDraftId(workspaceSlug, collectionPath, target),
    [collectionPath, target, workspaceSlug],
  );
  const isCreating = createNote.isPending || createInboxNote.isPending;

  useEffect(() => {
    if (!open) return;
    const draft = loadCreateNoteDraft(draftId);
    setContent(initialContent || draft?.content || "");
    setError(null);
    failedContentRef.current = undefined;
  }, [draftId, initialContent, open]);

  useEffect(() => {
    if (!open || !content) return;
    saveCreateNoteDraft(draftId, { content, open: true });
  }, [content, draftId, open]);

  useEffect(() => {
    if (
      hasRestoredOpenRef.current ||
      !restoreOpen ||
      !isInitialPageReloadRef.current ||
      controlledOpen !== undefined
    )
      return;
    hasRestoredOpenRef.current = true;
    const draft = loadCreateNoteDraft(draftId);
    if (!draft?.open) return;
    setContent(draft.content);
    setInternalOpen(true);
  }, [controlledOpen, draftId, restoreOpen]);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen);
      if (controlledOpen === undefined) setInternalOpen(nextOpen);
    },
    [controlledOpen, onOpenChange],
  );

  const close = useCallback(() => {
    setError(null);
    setOpen(false);
  }, [setOpen]);

  const create = useCallback(
    (
      noteContent = composeFrontMatter(
        frontMatter,
        (editorRef.current?.getMarkdown() ?? "").trim(),
      ).trim() || content.trim(),
    ) => {
      if (!noteContent || isCreating) return;
      setError(null);
      const onSuccess = (data: { note: CollectionNoteNode }) => {
        clearCreateNoteDraft(draftId);
        setContent("");
        close();
        const note = collectionNodeToAsset(data.note);
        if (note.type !== "note") return;
        if (target === "inbox") {
          persistNoteDrawer(`aska.note-drawer:inbox:${workspaceSlug}`, note);
          void navigate({
            to: "/$workspaceSlug/inbox",
            params: { workspaceSlug },
            search: {},
          });
        } else {
          persistNoteDrawer(
            `aska.note-drawer:collection:${workspaceSlug}:${collectionPath}`,
            note,
          );
          void navigate({
            to: "/$workspaceSlug/collections/$",
            params: { workspaceSlug, _splat: collectionPath },
            search: {},
          });
        }
      };
      const onError = (reason: unknown) => {
        const message =
          reason instanceof Error ? reason.message : "Could not create note.";
        failedContentRef.current = noteContent;
        setError(message);
        toast.error(message);
      };
      if (target === "inbox")
        createInboxNote.mutate(
          { content: noteContent },
          { onSuccess, onError },
        );
      else
        createNote.mutate(
          { content: noteContent, parentFolderPath, placement },
          { onSuccess, onError },
        );
    },
    [
      collectionPath,
      content,
      createInboxNote,
      createNote,
      draftId,
      frontMatter,
      isCreating,
      navigate,
      parentFolderPath,
      placement,
      target,
      workspaceSlug,
      close,
    ],
  );

  useEffect(() => {
    const noteContent = content.trim();
    if (
      !open ||
      !noteContent ||
      isCreating ||
      failedContentRef.current === noteContent
    )
      return;
    const timeout = window.setTimeout(
      () => create(noteContent),
      CREATE_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [content, create, isCreating, open]);

  return (
    <NoteWorkspace
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}
    >
      {children ? <NoteWorkspaceTrigger render={children} /> : null}
      <NoteWorkspaceContent>
        <NoteWorkspaceTitle>New note</NoteWorkspaceTitle>
        <Button
          className="absolute top-5 left-5 z-10 rounded-lg border border-transparent bg-transparent text-foreground shadow-none hover:bg-secondary focus-visible:border-border active:bg-foreground/[0.1]"
          variant="ghost"
          size="icon-lg"
          onClick={close}
        >
          <ArrowLeftIcon />
          <span className="sr-only">Back to board</span>
        </Button>
        <div className="note-workspace-scroll-container min-h-0 flex-1 overflow-y-auto">
          <div className="note-workspace-column">
            <Suspense fallback={<NoteEditorLoading />}>
              <NoteRichText
                ref={editorRef}
                markdown={frontMatter.body}
                editable
                autoFocus
                onChange={(nextBody) => {
                  failedContentRef.current = undefined;
                  setError(null);
                  const nextContent = composeFrontMatter(frontMatter, nextBody);
                  setContent(nextContent);
                  if (!nextContent.trim()) clearCreateNoteDraft(draftId);
                }}
                onSaveShortcut={() => create()}
              />
            </Suspense>
          </div>
        </div>
        {error ? (
          <div className="absolute right-4 bottom-4 left-4 z-10 flex items-center justify-between gap-3 rounded-lg bg-destructive/10 px-3 py-2 backdrop-blur-sm sm:right-auto sm:left-6">
            <p className="text-xs text-destructive">
              Your draft is stored on this device.
            </p>
            <Button variant="outline" size="sm" onClick={() => create()}>
              <RotateCcwIcon />
              Retry
            </Button>
          </div>
        ) : null}
      </NoteWorkspaceContent>
    </NoteWorkspace>
  );
}

function isPageReload(): boolean {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === "reload";
}
