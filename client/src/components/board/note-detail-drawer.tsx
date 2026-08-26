import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  DotIcon,
  InfoIcon,
  LoaderCircleIcon,
  PanelRightIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import {
  useCreateInboxNote,
  useCreateNote,
  useDeleteAsset,
  useUpdateNote,
} from "@/api/collection";
import type {
  BoardInsertionPlacement,
  CollectionNoteNode,
} from "@/api/collection";
import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import { NoteEditorErrorBoundary } from "@/components/board/note-editor-error-boundary";
import { NoteEditorLoading } from "@/components/board/note-editor-loading";
import {
  NoteWorkspace,
  NoteWorkspaceContent,
  NoteWorkspaceTitle,
  NoteWorkspaceTrigger,
} from "@/components/board/note-workspace-dialog";
import { useBoardInsertionPlacement } from "@/components/canvas";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { composeFrontMatter, parseFrontMatter } from "@/lib/front-matter";
import { composeCopiedNoteMarkdown } from "@/lib/note-copy";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import {
  clearCreateNoteDraft,
  getCreateNoteDraftId,
  loadCreateNoteDraft,
  saveCreateNoteDraft,
} from "@/lib/create-note-draft";
import { calculateNoteMetrics } from "@/lib/note-metrics";
import {
  getSaveableNoteContent,
  isNoteContentTooLong,
  NOTE_CONTENT_LIMIT_MESSAGE,
} from "@/lib/note-content";
import { cn } from "@/lib/utils";
import type { NoteAsset } from "@/types/asset";
import { useWorkspacePeek } from "@/components/app-shell/workspace-peek";

const AUTOSAVE_DELAY_MS = 700;
const SAVE_STATUS_VISIBLE_MS = 2_000;
const COPIED_RESET_MS = 1_500;
const NoteRichText = lazy(() =>
  import("@/components/board/note-rich-text").then((module) => ({
    default: module.NoteRichText,
  })),
);

type SaveState = "saved" | "saving" | "deleting" | "error" | "empty";
type ExtractionFeedback = {
  status: "extracting" | "success" | "error";
  destination: string;
};

export function NoteDetailDrawer({
  note,
  workspaceSlug,
  createOptions,
  children,
  noteExtractionTarget,
  onNoteChange,
  onClose,
}: {
  note: NoteAsset | undefined;
  workspaceSlug: string;
  createOptions?: {
    collectionPath: string;
    target?: "collection" | "inbox";
    initialContent?: string;
    restoreOpen?: boolean;
    open?: boolean;
    placement?: BoardInsertionPlacement;
  };
  children?: React.ReactElement;
  noteExtractionTarget?: {
    target?: "collection" | "inbox";
    collectionSlug?: string;
    parentFolderPath?: string;
  };
  onNoteChange?: (note: NoteAsset) => void;
  onClose: () => void;
}) {
  const isCreateMode = createOptions !== undefined;
  const [collectionSlug = "", ...folderSegments] = (
    createOptions?.collectionPath ?? ""
  )
    .split("/")
    .filter(Boolean);
  const parentFolderPath = folderSegments.join("/") || undefined;
  const {
    target: peekTarget,
    peekNote,
    setActiveNoteId,
    syncPeekNote,
    isResizing: isPeekResizing,
  } = useWorkspacePeek();
  const noteContentRef = useRef<HTMLDivElement>(null);
  const richTextRef = useRef<NoteRichTextHandle>(null);
  const draftRef = useRef(note?.content ?? "");
  const closeAfterSaveRef = useRef(false);
  const closeRequestedRef = useRef(false);
  const hasRestoredCreateOpenRef = useRef(false);
  const isInitialPageReloadRef = useRef(isPageReload());
  const failedContentRef = useRef<string | undefined>(undefined);
  const saveStatusHideTimeoutRef = useRef<number | undefined>(undefined);
  const extractionFeedbackTimeoutRef = useRef<number | undefined>(undefined);
  const copiedResetTimeoutRef = useRef<number | undefined>(undefined);
  const hasObservedSaveStateRef = useRef(false);
  const [draft, setDraft] = useState(note?.content ?? "");
  const [createdNote, setCreatedNote] = useState<NoteAsset>();
  const [workspaceOpen, setWorkspaceOpen] = useState(
    note !== undefined || Boolean(createOptions?.open),
  );
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showSaveState, setShowSaveState] = useState(false);
  const [copied, setCopied] = useState(false);
  const [extractionFeedback, setExtractionFeedback] =
    useState<ExtractionFeedback>();
  const activeNote = createdNote ?? note;
  const isPeekMirror =
    peekTarget?.type === "note" && peekTarget.asset.id === activeNote?.id;
  const createNote = useCreateNote(workspaceSlug, collectionSlug);
  const createInboxNote = useCreateInboxNote(workspaceSlug);
  const createCollectionPath = createOptions?.collectionPath ?? "";
  const createTarget = createOptions?.target ?? "collection";
  const createDraftId = useMemo(
    () =>
      isCreateMode
        ? getCreateNoteDraftId(
            workspaceSlug,
            createCollectionPath,
            createTarget,
          )
        : undefined,
    [createCollectionPath, createTarget, isCreateMode, workspaceSlug],
  );
  const closeWorkspace = useCallback(() => {
    closeRequestedRef.current = true;
    setActiveNoteId(undefined);
    setWorkspaceOpen(false);
  }, [setActiveNoteId]);
  const frontMatter = useMemo(() => parseFrontMatter(draft), [draft]);
  const updateNote = useUpdateNote(workspaceSlug);
  const deleteAsset = useDeleteAsset(workspaceSlug);
  const extractionCollectionSlug = noteExtractionTarget?.collectionSlug ?? "";
  const createExtractedCollectionNote = useCreateNote(
    workspaceSlug,
    extractionCollectionSlug,
  );
  const createExtractedInboxNote = useCreateInboxNote(workspaceSlug);
  const extractionPlacement = useBoardInsertionPlacement(
    workspaceSlug,
    [extractionCollectionSlug, noteExtractionTarget?.parentFolderPath]
      .filter(Boolean)
      .join("/"),
  );
  const extractionPosition = extractionPlacement?.position;
  const { isPending, mutate, reset } = updateNote;
  const noteId = activeNote?.id;
  const noteContent = activeNote?.content;
  const isCreating = createNote.isPending || createInboxNote.isPending;

  draftRef.current = draft;

  useEffect(() => {
    if (activeNote) {
      setWorkspaceOpen(true);
    } else {
      closeRequestedRef.current = false;
      setWorkspaceOpen(isCreateMode && Boolean(createOptions?.open));
    }
  }, [activeNote, createOptions?.open, isCreateMode]);

  useEffect(() => {
    if (!isCreateMode || !createDraftId || !workspaceOpen) return;
    const storedDraft = loadCreateNoteDraft(createDraftId);
    const nextDraft =
      createOptions.initialContent || storedDraft?.content || "";
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setSaveState("saved");
    failedContentRef.current = undefined;
  }, [
    createDraftId,
    createOptions?.initialContent,
    isCreateMode,
    workspaceOpen,
  ]);

  useEffect(() => {
    if (
      !isCreateMode ||
      hasRestoredCreateOpenRef.current ||
      !createOptions.restoreOpen ||
      !isInitialPageReloadRef.current ||
      createOptions.open !== undefined
    )
      return;
    hasRestoredCreateOpenRef.current = true;
    const storedDraft = createDraftId
      ? loadCreateNoteDraft(createDraftId)
      : undefined;
    if (!storedDraft?.open) return;
    draftRef.current = storedDraft.content;
    setDraft(storedDraft.content);
    setWorkspaceOpen(true);
  }, [
    createDraftId,
    createOptions?.open,
    createOptions?.restoreOpen,
    isCreateMode,
  ]);

  useEffect(() => {
    if (
      !isCreateMode ||
      activeNote ||
      !createDraftId ||
      !workspaceOpen ||
      !draft
    )
      return;
    saveCreateNoteDraft(createDraftId, { content: draft, open: true });
  }, [activeNote, createDraftId, draft, isCreateMode, workspaceOpen]);

  useEffect(() => {
    setActiveNoteId(activeNote?.id);
    return () => setActiveNoteId(undefined);
  }, [activeNote?.id, setActiveNoteId]);

  useEffect(() => {
    if (activeNote) syncPeekNote(activeNote);
  }, [activeNote, syncPeekNote]);

  useEffect(() => {
    if (saveStatusHideTimeoutRef.current !== undefined) {
      window.clearTimeout(saveStatusHideTimeoutRef.current);
      saveStatusHideTimeoutRef.current = undefined;
    }

    if (!hasObservedSaveStateRef.current) {
      hasObservedSaveStateRef.current = true;
      return;
    }

    setShowSaveState(true);
    if (saveState === "saved") {
      saveStatusHideTimeoutRef.current = window.setTimeout(
        () => setShowSaveState(false),
        SAVE_STATUS_VISIBLE_MS,
      );
    }
  }, [saveState]);

  useEffect(
    () => () => {
      if (extractionFeedbackTimeoutRef.current !== undefined) {
        window.clearTimeout(extractionFeedbackTimeoutRef.current);
      }
      if (copiedResetTimeoutRef.current !== undefined) {
        window.clearTimeout(copiedResetTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!noteId || noteContent === undefined) return;
    if (isCreateMode && createdNote?.id === noteId) return;
    const recoveredDraft = loadEditDraft(noteId);
    const nextDraft = recoveredDraft ?? noteContent;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setSaveState(
      recoveredDraft && recoveredDraft !== noteContent ? "saving" : "saved",
    );
    failedContentRef.current = undefined;
    reset();
  }, [createdNote?.id, isCreateMode, noteContent, noteId, reset]);

  useEffect(() => {
    const container = noteContentRef.current;
    if (container) container.scrollTop = 0;
  }, [noteId]);

  useEffect(() => {
    if (!noteId || draft !== noteContent) return;
    clearEditDraft(noteId);
    failedContentRef.current = undefined;
    setSaveState("saved");
  }, [draft, noteContent, noteId]);

  const create = useCallback(
    (content: string) => {
      if (!isCreateMode || activeNote || isCreating) return;
      if (isNoteContentTooLong(content)) {
        failedContentRef.current = content;
        setSaveState("error");
        toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
        return;
      }

      setSaveState("saving");
      const onSuccess = (data: { note: CollectionNoteNode }) => {
        const nextNote = collectionNodeToAsset(data.note);
        if (nextNote.type !== "note") return;
        clearCreateNoteDraft(createDraftId ?? null);
        setCreatedNote(nextNote);
        draftRef.current = content;
        setDraft(content);
        failedContentRef.current = undefined;
        setSaveState("saved");
      };
      const onError = (reason: unknown) => {
        failedContentRef.current = content;
        setSaveState("error");
        toast.error(
          getUserFacingApiErrorMessage(reason, "Could not create note."),
        );
      };

      if (createOptions.target === "inbox") {
        createInboxNote.mutate({ content }, { onSuccess, onError });
      } else {
        createNote.mutate(
          {
            content,
            parentFolderPath,
            placement: createOptions.placement,
          },
          { onSuccess, onError },
        );
      }
    },
    [
      activeNote,
      createInboxNote,
      createNote,
      createDraftId,
      createOptions?.placement,
      createOptions?.target,
      isCreateMode,
      isCreating,
      parentFolderPath,
    ],
  );

  const persist = useCallback(
    (content: string, closeAfterSave = false) => {
      if (!noteId) return;

      if (isNoteContentTooLong(content)) {
        failedContentRef.current = content;
        closeAfterSaveRef.current = false;
        setSaveState("error");
        toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
        return;
      }

      if (content === noteContent) {
        if (draftRef.current === content) {
          draftRef.current = content;
          setDraft(content);
          clearEditDraft(noteId);
          setSaveState("saved");
        }
        if (closeAfterSave) closeWorkspace();
        return;
      }

      if (isPending) return;

      closeAfterSaveRef.current ||= closeAfterSave;
      setSaveState("saving");
      mutate(
        { assetId: noteId, content },
        {
          onSuccess: ({ note: updatedNote }) => {
            failedContentRef.current = undefined;
            if (activeNote && onNoteChange) {
              onNoteChange({
                ...activeNote,
                ...updatedNote,
                color: updatedNote.color ?? undefined,
              });
            }
            if (draftRef.current === content) {
              draftRef.current = content;
              setDraft(content);
              clearEditDraft(noteId);
              setSaveState("saved");
            }
            if (closeAfterSaveRef.current) {
              closeAfterSaveRef.current = false;
              const latestContent = getSaveableNoteContent(draftRef.current);
              if (latestContent && latestContent !== content) {
                window.setTimeout(() => persist(latestContent, true), 0);
                return;
              }
              closeWorkspace();
            }
          },
          onError: (error) => {
            failedContentRef.current = content;
            closeAfterSaveRef.current = false;
            setSaveState("error");
            toast.error(
              getUserFacingApiErrorMessage(error, "Could not save note."),
            );
          },
        },
      );
    },
    [
      closeWorkspace,
      isPending,
      mutate,
      activeNote,
      noteContent,
      noteId,
      onNoteChange,
    ],
  );

  useEffect(() => {
    if (isCreateMode && !activeNote) {
      const content = getSaveableNoteContent(draft);
      if (!content || isCreating || failedContentRef.current === content) {
        if (!content && draft.trim()) setSaveState("empty");
        return;
      }
      const timeout = window.setTimeout(
        () => create(content),
        AUTOSAVE_DELAY_MS,
      );
      return () => window.clearTimeout(timeout);
    }
    if (!noteId || draft === noteContent || isPending) return;
    const content = getSaveableNoteContent(draft);
    if (!content) {
      setSaveState("empty");
      return;
    }
    if (failedContentRef.current === content) return;
    const timeout = window.setTimeout(
      () => persist(content),
      AUTOSAVE_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [
    activeNote,
    create,
    draft,
    isCreateMode,
    isCreating,
    isPending,
    noteContent,
    noteId,
    persist,
  ]);

  const liveMetrics = calculateNoteMetrics(draft);
  const metrics = {
    words: `${liveMetrics.wordCount.toLocaleString()} words`,
    readingTime: `${liveMetrics.readingTimeMinutes.toLocaleString()} ${liveMetrics.readingTimeMinutes === 1 ? "min" : "mins"} read`,
  };
  const createdLabel = activeNote?.createdAt
    ? formatNoteDate(activeNote.createdAt)
    : undefined;
  const updatedTimestamp = activeNote?.updatedAt ?? activeNote?.createdAt;
  const updatedLabel = updatedTimestamp
    ? formatRelativeTime(updatedTimestamp)
    : undefined;

  const extractSelection = useCallback(
    (content: string) => {
      if (!noteExtractionTarget) return;
      window.getSelection()?.removeAllRanges();
      const destination =
        noteExtractionTarget.target === "inbox"
          ? "Inbox"
          : noteExtractionTarget.parentFolderPath
            ? "this folder"
            : "this collection";

      if (isNoteContentTooLong(content)) {
        setExtractionFeedback({ status: "error", destination });
        toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
        return;
      }

      if (extractionFeedbackTimeoutRef.current !== undefined) {
        window.clearTimeout(extractionFeedbackTimeoutRef.current);
      }
      setExtractionFeedback({ status: "extracting", destination });

      const onSuccess = () => {
        setExtractionFeedback({ status: "success", destination });
        extractionFeedbackTimeoutRef.current = window.setTimeout(
          () => setExtractionFeedback(undefined),
          2_500,
        );
      };
      const onError = () => {
        setExtractionFeedback({ status: "error", destination });
        extractionFeedbackTimeoutRef.current = window.setTimeout(
          () => setExtractionFeedback(undefined),
          4_000,
        );
      };
      if (noteExtractionTarget.target === "inbox") {
        createExtractedInboxNote.mutate({ content }, { onSuccess, onError });
      } else {
        createExtractedCollectionNote.mutate(
          {
            content,
            parentFolderPath: noteExtractionTarget.parentFolderPath,
            placement: extractionPosition
              ? { position: extractionPosition }
              : undefined,
          },
          { onSuccess, onError },
        );
      }
    },
    [
      createExtractedCollectionNote,
      createExtractedInboxNote,
      extractionPosition,
      noteExtractionTarget,
    ],
  );

  function handleDraftChange(bodyContent: string) {
    const content = composeFrontMatter(frontMatter, bodyContent);
    draftRef.current = content;
    setDraft(content);
    failedContentRef.current = undefined;
    if (activeNote) {
      if (content === activeNote.content) clearEditDraft(activeNote.id);
      else saveEditDraft(activeNote.id, content);
    } else if (createDraftId) {
      if (content.trim()) {
        saveCreateNoteDraft(createDraftId, { content, open: true });
      } else {
        clearCreateNoteDraft(createDraftId);
      }
    }
  }

  function requestClose() {
    if (!activeNote) {
      closeWorkspace();
      return;
    }
    const content = getSaveableNoteContent(draftRef.current);
    if (!content) {
      if (deleteAsset.isPending) return;
      setSaveState("deleting");
      closeWorkspace();
      void deleteAsset.mutateAsync(activeNote.id).catch((error) => {
        toast.error(
          getUserFacingApiErrorMessage(error, "Could not delete note."),
        );
      });
      return;
    }
    if (content === activeNote.content) return closeWorkspace();
    if (updateNote.isPending) {
      closeAfterSaveRef.current = true;
      return;
    }
    persist(content, true);
  }

  function copyNoteMarkdown() {
    const body =
      richTextRef.current?.getMarkdown() ??
      parseFrontMatter(draftRef.current).body;
    const markdown = composeCopiedNoteMarkdown(activeNote?.content ?? "", body);
    if (!markdown.trim()) {
      toast.error("Nothing to copy yet.");
      return;
    }
    if (typeof navigator.clipboard?.writeText !== "function") {
      toast.error("Clipboard is not available.");
      return;
    }
    void navigator.clipboard
      .writeText(markdown)
      .then(() => {
        setCopied(true);
        if (copiedResetTimeoutRef.current !== undefined) {
          window.clearTimeout(copiedResetTimeoutRef.current);
        }
        copiedResetTimeoutRef.current = window.setTimeout(
          () => setCopied(false),
          COPIED_RESET_MS,
        );
      })
      .catch(() => toast.error("Unable to copy note."));
  }

  return (
    <NoteWorkspace
      open={workspaceOpen}
      disablePointerDismissal={isPeekResizing}
      onOpenChange={(open) => {
        if (!open && isPeekResizing) return;
        if (open) {
          closeRequestedRef.current = false;
          setWorkspaceOpen(true);
        } else {
          requestClose();
        }
      }}
      onOpenChangeComplete={(open) => {
        if (open || !closeRequestedRef.current) return;
        closeRequestedRef.current = false;
        if (isCreateMode) {
          setCreatedNote(undefined);
          setDraft("");
          draftRef.current = "";
          setSaveState("saved");
        }
        onClose();
      }}
    >
      {children ? <NoteWorkspaceTrigger render={children} /> : null}
      <NoteWorkspaceContent className="md:right-[calc(var(--workspace-peek-rail-width)+var(--workspace-peek-stage-gap)+var(--app-shell-inset))] md:w-[calc(100dvw-var(--workspace-peek-rail-width)-var(--workspace-peek-stage-gap)-var(--app-shell-inset))] md:transition-[right,width,opacity,scale,transform] md:duration-[160ms] md:ease-[cubic-bezier(0.16,1,0.3,1)] md:motion-reduce:transition-none">
        <NoteWorkspaceTitle>
          {activeNote ? "Note" : "New note"}
        </NoteWorkspaceTitle>
        <div className="relative z-20 mt-[var(--app-shell-inset)] flex shrink-0 items-center justify-between gap-3 rounded-t-xl rounded-b-none p-2 text-xs font-medium text-muted-foreground">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  className="ml-[var(--app-shell-inset)] size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                  variant="ghost"
                  size="icon"
                  aria-label="Back to board"
                  onClick={requestClose}
                >
                  <ArrowLeftIcon />
                  <span className="sr-only">Back to board</span>
                </Button>
              }
            />
            <TooltipContent side="bottom">Back to board</TooltipContent>
          </Tooltip>
          <AnimatePresence initial={false}>
            {extractionFeedback ? (
              <motion.div
                key={extractionFeedback.status}
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                role="status"
                aria-live="polite"
                className={cn(
                  "pointer-events-none absolute top-5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg backdrop-blur-xl",
                  extractionFeedback.status === "error" &&
                    "border-destructive/30 bg-destructive/10 text-destructive",
                )}
              >
                {extractionFeedback.status === "extracting" ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                ) : extractionFeedback.status === "success" ? (
                  <CheckIcon className="size-3.5" />
                ) : null}
                <span>
                  {extractionFeedback.status === "extracting"
                    ? `Extracting to ${extractionFeedback.destination}…`
                    : extractionFeedback.status === "success"
                      ? `Extracted to ${extractionFeedback.destination}`
                      : "Couldn’t extract note"}
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="flex min-w-0 items-center justify-end gap-0">
            <span
              className={cn(
                "inline-block w-24 text-right transition-opacity duration-100 ease-out motion-reduce:transition-none",
                showSaveState ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              aria-hidden={!showSaveState}
            >
              {saveStateLabel(saveState)}
            </span>
            {metrics ? (
              <>
                <span
                  className={cn(
                    "mx-3 hidden h-4 w-px bg-border transition-opacity duration-100 ease-out sm:block motion-reduce:transition-none",
                    showSaveState ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{metrics.words}</span>
                <DotIcon
                  className="mx-1.5 hidden size-3 sm:block"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{metrics.readingTime}</span>
              </>
            ) : null}
            {showSaveState || metrics ? (
              <span
                className="mx-2 hidden h-4 w-px bg-border sm:block"
                aria-hidden="true"
              />
            ) : null}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground"
                    aria-label={copied ? "Note copied" : "Copy markdown"}
                    onClick={copyNoteMarkdown}
                  >
                    {copied ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                    <span className="sr-only">
                      {copied ? "Copied" : "Copy markdown"}
                    </span>
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                {copied ? "Copied" : "Copy markdown"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Peek note"
                    disabled={!activeNote || isPeekMirror}
                    onClick={() => {
                      if (!activeNote) return;
                      peekNote(activeNote);
                      closeWorkspace();
                    }}
                  >
                    <PanelRightIcon className="size-4" />
                    <span className="sr-only">Peek note</span>
                  </Button>
                }
              />
              <TooltipContent side="bottom">Peek note</TooltipContent>
            </Tooltip>
            {createdLabel || updatedLabel ? (
              <>
                <HoverCard>
                  <HoverCardTrigger
                    delay={0}
                    closeDelay={100}
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground"
                        aria-label="Note details"
                      >
                        <InfoIcon className="size-4" />
                      </Button>
                    }
                  ></HoverCardTrigger>
                  <HoverCardContent
                    align="end"
                    sideOffset={10}
                    className="w-fit min-w-0 border-border/60 bg-background/95 whitespace-nowrap shadow-2xl backdrop-blur-xl"
                  >
                    <div className="flex flex-col gap-1 text-xs">
                      {createdLabel ? (
                        <div>
                          <span className="text-muted-foreground">
                            Created at{" "}
                          </span>
                          <span>{createdLabel}</span>
                        </div>
                      ) : null}
                      {updatedLabel ? (
                        <div>
                          <span className="text-muted-foreground">
                            Updated at{" "}
                          </span>
                          <span>{updatedLabel}</span>
                        </div>
                      ) : null}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </>
            ) : null}
          </div>
        </div>
        <div
          ref={noteContentRef}
          className="note-workspace-scroll-container min-h-0 flex-1 overflow-y-auto"
        >
          <div className="note-workspace-column [&_.ProseMirror]:!pt-8">
            {isCreateMode || activeNote ? (
              <Suspense fallback={<NoteEditorLoading />}>
                <NoteEditorErrorBoundary noteId={activeNote?.id ?? "new-note"}>
                  <NoteRichText
                    key={isCreateMode ? "create-note-editor" : activeNote?.id}
                    ref={richTextRef}
                    markdown={frontMatter.body}
                    editable
                    autoFocus
                    scrollContainerRef={noteContentRef}
                    onExtractSelection={
                      noteExtractionTarget ? extractSelection : undefined
                    }
                    onHighlightSelection={
                      noteExtractionTarget
                        ? (content) =>
                            persist(
                              composeFrontMatter(
                                parseFrontMatter(draftRef.current),
                                content,
                              ),
                            )
                        : undefined
                    }
                    isHighlighting={saveState === "saving"}
                    onChange={handleDraftChange}
                    onSaveShortcut={() => {
                      const content = getSaveableNoteContent(draftRef.current);
                      if (!content) return;
                      if (isCreateMode && !activeNote) create(content);
                      else persist(content);
                    }}
                  />
                </NoteEditorErrorBoundary>
              </Suspense>
            ) : null}
          </div>
        </div>
        {saveState === "error" ? (
          <p className="absolute right-4 bottom-4 left-4 z-10 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive backdrop-blur-sm sm:right-auto sm:left-6">
            {isNoteContentTooLong(draft)
              ? `${NOTE_CONTENT_LIMIT_MESSAGE} `
              : ""}
            Changes are stored on this device. Keep editing to retry saving.
          </p>
        ) : null}
      </NoteWorkspaceContent>
    </NoteWorkspace>
  );
}

function saveStateLabel(state: SaveState) {
  if (state === "saving") return "Saving…";
  if (state === "deleting") return "Deleting…";
  if (state === "error") return "Save failed";
  if (state === "empty") return "Add text to save";
  return "Saved";
}

const NOTE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const NOTE_DATE_WITH_YEAR_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.getFullYear() === new Date().getFullYear()
    ? NOTE_DATE_FORMAT.format(date)
    : NOTE_DATE_WITH_YEAR_FORMAT.format(date);
}

function formatRelativeTime(iso: string): string {
  const elapsedMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs)) return "";
  if (elapsedMs < 60_000) return "just now";

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatNoteDate(iso);
}

function editDraftKey(noteId: string) {
  return `aska.edit-note-draft:${noteId}`;
}

function loadEditDraft(noteId: string): string | undefined {
  try {
    return localStorage.getItem(editDraftKey(noteId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveEditDraft(noteId: string, content: string) {
  try {
    localStorage.setItem(editDraftKey(noteId), content);
  } catch {}
}

function clearEditDraft(noteId: string) {
  try {
    localStorage.removeItem(editDraftKey(noteId));
  } catch {}
}

function isPageReload(): boolean {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === "reload";
}
