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
  DotIcon,
  InfoIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import {
  useCreateInboxNote,
  useCreateNote,
  useDeleteAsset,
  useUpdateNote,
} from "@/api/collection";
import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import { NoteEditorErrorBoundary } from "@/components/board/note-editor-error-boundary";
import { NoteEditorLoading } from "@/components/board/note-editor-loading";
import {
  NoteWorkspace,
  NoteWorkspaceContent,
  NoteWorkspaceTitle,
} from "@/components/board/note-workspace-dialog";
import { useBoardInsertionPlacement } from "@/components/canvas";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { composeFrontMatter, parseFrontMatter } from "@/lib/front-matter";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import {
  getSaveableNoteContent,
  isNoteContentTooLong,
  NOTE_CONTENT_LIMIT_MESSAGE,
} from "@/lib/note-content";
import { cn } from "@/lib/utils";
import type { NoteAsset } from "@/types/asset";

const AUTOSAVE_DELAY_MS = 700;
const SAVE_STATUS_VISIBLE_MS = 2_000;
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
  noteExtractionTarget,
  onNoteChange,
  onClose,
}: {
  note: NoteAsset | undefined;
  workspaceSlug: string;
  noteExtractionTarget?: {
    target?: "collection" | "inbox";
    collectionSlug?: string;
    parentFolderPath?: string;
  };
  onNoteChange?: (note: NoteAsset) => void;
  onClose: () => void;
}) {
  const noteContentRef = useRef<HTMLDivElement>(null);
  const richTextRef = useRef<NoteRichTextHandle>(null);
  const draftRef = useRef(note?.content ?? "");
  const closeAfterSaveRef = useRef(false);
  const failedContentRef = useRef<string | undefined>(undefined);
  const detailsCloseTimeoutRef = useRef<number | undefined>(undefined);
  const saveStatusHideTimeoutRef = useRef<number | undefined>(undefined);
  const extractionFeedbackTimeoutRef = useRef<number | undefined>(undefined);
  const hasObservedSaveStateRef = useRef(false);
  const [draft, setDraft] = useState(note?.content ?? "");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showSaveState, setShowSaveState] = useState(false);
  const [extractionFeedback, setExtractionFeedback] =
    useState<ExtractionFeedback>();
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
  const noteId = note?.id;
  const noteContent = note?.content;

  draftRef.current = draft;

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
    },
    [],
  );

  useEffect(() => {
    if (!noteId || noteContent === undefined) return;
    const recoveredDraft = loadEditDraft(noteId);
    const nextDraft = recoveredDraft ?? noteContent;
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setSaveState(
      recoveredDraft && recoveredDraft !== noteContent ? "saving" : "saved",
    );
    failedContentRef.current = undefined;
    reset();
  }, [noteContent, noteId, reset]);

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
        if (closeAfterSave) onClose();
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
            if (note && onNoteChange) {
              onNoteChange({
                ...note,
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
              onClose();
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
    [isPending, mutate, note, noteContent, noteId, onClose, onNoteChange],
  );

  useEffect(() => {
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
  }, [draft, isPending, noteContent, noteId, persist]);

  const metrics =
    note?.wordCount !== undefined && note.readingTimeMinutes !== undefined
      ? {
          words: `${note.wordCount.toLocaleString()} words`,
          readingTime: `${note.readingTimeMinutes.toLocaleString()} ${note.readingTimeMinutes === 1 ? "min" : "mins"} read`,
        }
      : undefined;
  const createdLabel = note?.createdAt
    ? formatNoteDate(note.createdAt)
    : undefined;
  const updatedTimestamp = note?.updatedAt ?? note?.createdAt;
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

  function openDetails() {
    if (detailsCloseTimeoutRef.current !== undefined) {
      window.clearTimeout(detailsCloseTimeoutRef.current);
      detailsCloseTimeoutRef.current = undefined;
    }
    setDetailsOpen(true);
  }

  function closeDetailsSoon() {
    if (detailsCloseTimeoutRef.current !== undefined) {
      window.clearTimeout(detailsCloseTimeoutRef.current);
    }
    detailsCloseTimeoutRef.current = window.setTimeout(
      () => setDetailsOpen(false),
      120,
    );
  }

  function handleDraftChange(bodyContent: string) {
    if (!note) return;
    const content = composeFrontMatter(frontMatter, bodyContent);
    draftRef.current = content;
    setDraft(content);
    failedContentRef.current = undefined;
    if (content === note.content) clearEditDraft(note.id);
    else saveEditDraft(note.id, content);
  }

  function requestClose() {
    if (!note) return onClose();
    const content = getSaveableNoteContent(draftRef.current);
    if (!content) {
      if (deleteAsset.isPending) return;
      setSaveState("deleting");
      deleteAsset.mutate(note.id, {
        onSuccess: onClose,
        onError: (error) => {
          setSaveState("error");
          toast.error(
            getUserFacingApiErrorMessage(error, "Could not delete note."),
          );
        },
      });
      return;
    }
    if (content === note.content) return onClose();
    if (updateNote.isPending) {
      closeAfterSaveRef.current = true;
      return;
    }
    persist(content, true);
  }

  return (
    <NoteWorkspace
      open={note !== undefined}
      onOpenChange={(open) => !open && requestClose()}
    >
      <NoteWorkspaceContent>
        <NoteWorkspaceTitle>Note</NoteWorkspaceTitle>
        <Button
          className="absolute top-5 left-5 z-10 rounded-lg border border-transparent bg-transparent text-foreground shadow-none hover:bg-secondary focus-visible:border-border active:bg-foreground/[0.1]"
          variant="ghost"
          size="icon-lg"
          onClick={requestClose}
        >
          <ArrowLeftIcon />
          <span className="sr-only">Back to board</span>
        </Button>
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
        <div className="absolute top-5 right-5 z-10 flex h-10 items-center rounded-lg pt-0 pr-0 pb-0 pl-3.5 text-xs font-medium text-muted-foreground">
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
          {createdLabel || updatedLabel ? (
            <>
              {showSaveState || metrics ? (
                <span
                  className="mx-2 hidden h-4 w-px bg-border sm:block"
                  aria-hidden="true"
                />
              ) : null}
              <Popover open={detailsOpen} onOpenChange={setDetailsOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground data-popup-open:bg-secondary data-popup-open:text-foreground"
                      aria-label="Note details"
                      onMouseEnter={openDetails}
                      onMouseLeave={closeDetailsSoon}
                      onFocus={openDetails}
                    />
                  }
                >
                  <InfoIcon className="size-4" />
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={10}
                  onMouseEnter={openDetails}
                  onMouseLeave={closeDetailsSoon}
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
                </PopoverContent>
              </Popover>
            </>
          ) : null}
        </div>
        <div
          ref={noteContentRef}
          className="note-workspace-scroll-container min-h-0 flex-1 overflow-y-auto"
        >
          <div className="note-workspace-column">
            {note ? (
              <Suspense fallback={<NoteEditorLoading />}>
                <NoteEditorErrorBoundary noteId={note.id}>
                  <NoteRichText
                    key={note.id}
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
                      if (content) persist(content);
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
