import "./note-workspace.css";

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
  LocateFixedIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  Minimize2Icon,
  PanelRightIcon,
  XIcon,
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
  AssetLocation,
  BoardInsertionPlacement,
  CollectionNoteNode,
} from "@/api/collection";
import { fetchPeekableAsset } from "@/api/collection/fetchers";
import type { NoteMentionTarget } from "@/api/note-mentions/types";
import type { NoteRichTextHandle } from "@/components/board/note-rich-text";
import { CopyFeedbackIcon } from "@/components/ui/copy-feedback-icon";
import { NoteEditorErrorBoundary } from "@/components/board/note-editor-error-boundary";
import { NoteEditorLoading } from "@/components/board/note-editor-loading";
import { NoteHighlightControl } from "@/components/board/note-highlight-control";
import { NoteBacklinks } from "@/components/board/note-backlinks";
import { NoteSaveStatus } from "@/components/board/note-save-status";
import {
  isSameSaveSnapshot,
  resolveNoteSaveCompletion,
  type NoteSaveSnapshot,
} from "@/components/board/note-save-reconciliation";
import { NoteTitleField } from "@/components/board/note-title-field";
import {
  NoteWorkspace,
  NoteWorkspaceContent,
  NoteWorkspaceTitle,
  NoteWorkspaceTrigger,
} from "@/components/board/note-workspace-dialog";
import { useBoardInsertionPlacement } from "@/components/canvas";
import { Button } from "@/components/ui/button";
import { AssetTimestampCard } from "@/components/board/asset-timestamp-card";
import { ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS } from "@/components/board/asset-viewer-control-styles";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { composeFrontMatter, parseFrontMatter } from "@/lib/front-matter";
import { composeCopiedNoteMarkdown } from "@/lib/note-copy";
import { getUserFacingApiErrorMessage } from "@/lib/api";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { matchesKeybinding, PEEK_ASSET_SHORTCUT } from "@/lib/keybindings";
import { getPlatformAlt, getPlatformShift } from "@/lib/platform";
import {
  clearCreateNoteDraft,
  getCreateNoteDraftId,
  loadCreateNoteDraft,
  saveCreateNoteDraft,
} from "@/lib/create-note-draft";
import {
  getSaveableNoteContent,
  hasSaveableNote,
  isNoteContentTooLong,
  NOTE_CONTENT_LIMIT_MESSAGE,
} from "@/lib/note-content";
import { GLASS_FRAME_CLASS } from "@/lib/glass";
import { cn } from "@/lib/utils";
import type { NoteHighlightColor } from "@/lib/note-highlights";
import type { ColorAsset, NoteAsset } from "@/types/asset";
import {
  useWorkspacePeek,
  type PeekColorScope,
} from "@/components/app-shell/workspace-peek";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBlocker } from "@tanstack/react-router";
import { parseWorkspaceAssetPath } from "@/lib/workspace-asset-url";
import {
  clearEditDraft,
  getNoteSaveErrorMessage,
  loadEditDraft,
  loadLegacyEditDraft,
  saveEditDraft,
} from "@/lib/note-edit-draft";

const AUTOSAVE_DELAY_MS = 700;
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
  location,
  createOptions,
  children,
  noteExtractionTarget,
  onNoteChange,
  onOpenReferencedColor,
  onPromote,
  onSwap,
  onBack,
  onDismissAll,
  onShowInBoard,
  view,
  onViewChange,
  loading = false,
  open: controlledOpen,
  onRequestClose,
  onClose,
}: {
  note: NoteAsset | undefined;
  workspaceSlug: string;
  location: AssetLocation;
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
  onOpenReferencedColor?: (color: ColorAsset) => void;
  onPromote?: (
    note: NoteAsset,
    previousNote?: NoteAsset,
  ) => void | Promise<boolean>;
  onSwap?: (note: NoteAsset, previousNote: NoteAsset) => Promise<boolean>;
  onBack?: () => void;
  onDismissAll?: () => void;
  onShowInBoard?: () => void;
  view?: "modal" | "full";
  onViewChange?: (view: "modal" | "full") => void;
  loading?: boolean;
  open?: boolean;
  onRequestClose?: () => void;
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
    peekColor,
    setActiveNoteId,
    setNotePromotionHandler,
    setMainNoteLeaveHandler,
    setNoteSwapHandler,
    flushPeekNote,
    syncPeekNote,
    isResizing: isPeekResizing,
  } = useWorkspacePeek();
  const isMobile = useIsMobile();
  const split = Boolean(peekTarget) && !isMobile;
  const [localView, setLocalView] = useState<"modal" | "full">("full");
  const expanded = isMobile || split || (view ?? localView) === "full";
  const toggleExpanded = () => {
    const nextView = expanded ? "modal" : "full";
    if (onViewChange) onViewChange(nextView);
    else setLocalView(nextView);
  };
  const noteContentRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const richTextRef = useRef<NoteRichTextHandle>(null);
  const draftRef = useRef(note?.content ?? "");
  const titleRef = useRef(note?.title ?? "");
  const committedNoteRef = useRef<NoteAsset | undefined>(note);
  const editRevisionRef = useRef(0);
  const activeSaveSnapshotRef = useRef<NoteSaveSnapshot | undefined>(undefined);
  const deletingNoteRef = useRef<string | undefined>(undefined);
  const queuedSaveSnapshotRef = useRef<NoteSaveSnapshot | undefined>(undefined);
  const hasLocalEditRef = useRef(false);
  const syncedNoteIdRef = useRef<string | undefined>(undefined);
  const closeAfterSaveRef = useRef(false);
  const closeRequestedRef = useRef(false);
  const dismissAllRef = useRef(false);
  const hasRestoredCreateOpenRef = useRef(false);
  const isInitialPageReloadRef = useRef(isPageReload());
  const failedSaveSnapshotRef = useRef<NoteSaveSnapshot | undefined>(undefined);
  const extractionFeedbackTimeoutRef = useRef<number | undefined>(undefined);
  const copiedResetTimeoutRef = useRef<number | undefined>(undefined);
  const [draft, setDraft] = useState(note?.content ?? "");
  const [title, setTitle] = useState(note?.title ?? "");
  const [hydratedNoteId, setHydratedNoteId] = useState<string>();
  const [createdNote, setCreatedNote] = useState<NoteAsset>();
  const [workspaceOpen, setWorkspaceOpen] = useState(
    note !== undefined || Boolean(createOptions?.open),
  );
  const isWorkspaceOpen = controlledOpen ?? workspaceOpen;
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [copied, setCopied] = useState(false);
  const saveCurrentEditDraft = useCallback(
    (id: string, content: string, title: string) => {
      const base = committedNoteRef.current;
      if (base?.id === id)
        saveEditDraft(id, content, title, base.content, base.title ?? null);
    },
    [],
  );
  const [highlightColor, setHighlightColor] = useState<NoteHighlightColor>();
  const [highlightMode, setHighlightMode] = useState(false);
  const [canRemoveHighlight, setCanRemoveHighlight] = useState(false);
  const [extractionFeedback, setExtractionFeedback] =
    useState<ExtractionFeedback>();
  const activeNote = createdNote ?? note;
  const isPeekMirror =
    peekTarget?.type === "note" && peekTarget.asset.id === activeNote?.id;
  useEffect(() => {
    setHighlightMode(false);
    setHighlightColor(undefined);
    setCanRemoveHighlight(false);
  }, [activeNote?.id, isCreateMode]);
  const handleHighlightModeChange = useCallback((active: boolean) => {
    setHighlightMode(active);
    if (!active) setHighlightColor(undefined);
  }, []);
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
    if (controlledOpen === undefined) setWorkspaceOpen(false);
    else if (dismissAllRef.current) {
      dismissAllRef.current = false;
      onDismissAll?.();
    } else onRequestClose?.();
  }, [controlledOpen, onDismissAll, onRequestClose, setActiveNoteId]);
  const frontMatter = useMemo(() => parseFrontMatter(draft), [draft]);
  const updateNote = useUpdateNote(workspaceSlug);
  const { mutateAsync: deleteAssetAsync } = useDeleteAsset(workspaceSlug);
  const deleteEmptyNote = useCallback(
    async (id: string, onDeleted: () => void) => {
      if (deletingNoteRef.current === id) return false;
      const base = committedNoteRef.current;
      if (!base || base.id !== id) return false;
      deletingNoteRef.current = id;
      const startedAtRevision = editRevisionRef.current;
      setSaveState("deleting");
      try {
        await deleteAssetAsync({
          assetId: id,
          expectedContent: base.content,
          expectedTitle: base.title ?? null,
        });
        if (
          editRevisionRef.current !== startedAtRevision &&
          hasSaveableNote(titleRef.current, draftRef.current)
        ) {
          saveCurrentEditDraft(id, draftRef.current, titleRef.current);
          syncedNoteIdRef.current = undefined;
          setSaveState("error");
          toast.error(
            "This note was deleted while you edited it. Your new text remains in the editor; copy it before leaving.",
          );
          return false;
        }
        clearEditDraft(id);
        onDeleted();
        return true;
      } catch (error) {
        setSaveState("error");
        toast.error(getNoteSaveErrorMessage(error, "Could not delete note."));
        return false;
      } finally {
        deletingNoteRef.current = undefined;
      }
    },
    [deleteAssetAsync, saveCurrentEditDraft],
  );
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
  const { isPending, mutate, mutateAsync, reset } = updateNote;
  const noteId = activeNote?.id;
  const noteContent = activeNote?.content;
  const isCreating = createNote.isPending || createInboxNote.isPending;

  draftRef.current = draft;
  titleRef.current = title;

  const getLatestSaveSnapshot = useCallback(
    (): NoteSaveSnapshot => ({
      content: draftRef.current,
      title: titleRef.current,
      revision: editRevisionRef.current,
    }),
    [],
  );

  useEffect(() => {
    if (activeNote) {
      setWorkspaceOpen(true);
    } else {
      closeRequestedRef.current = false;
      setWorkspaceOpen(isCreateMode && Boolean(createOptions?.open));
    }
  }, [activeNote, createOptions?.open, isCreateMode]);

  useEffect(() => {
    if (!isCreateMode || activeNote || !isWorkspaceOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      const input = titleInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [activeNote, isCreateMode, isWorkspaceOpen]);

  useEffect(() => {
    if (!isCreateMode || !createDraftId || !isWorkspaceOpen) return;
    const storedDraft = loadCreateNoteDraft(createDraftId);
    const nextDraft =
      createOptions.initialContent || storedDraft?.content || "";
    const nextTitle = storedDraft?.title ?? "";
    draftRef.current = nextDraft;
    titleRef.current = nextTitle;
    editRevisionRef.current += 1;
    setDraft(nextDraft);
    setTitle(nextTitle);
    setSaveState("saved");
    failedSaveSnapshotRef.current = undefined;
  }, [
    createDraftId,
    createOptions?.initialContent,
    isCreateMode,
    isWorkspaceOpen,
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
    titleRef.current = storedDraft.title ?? "";
    editRevisionRef.current += 1;
    setDraft(storedDraft.content);
    setTitle(storedDraft.title ?? "");
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
      !isWorkspaceOpen ||
      !hasSaveableNote(title, draft)
    )
      return;
    saveCreateNoteDraft(createDraftId, { content: draft, title, open: true });
  }, [activeNote, createDraftId, draft, isCreateMode, isWorkspaceOpen, title]);

  useEffect(() => {
    setActiveNoteId(activeNote?.id);
    return () => setActiveNoteId(undefined);
  }, [activeNote?.id, setActiveNoteId]);

  useEffect(() => {
    if (activeNote) syncPeekNote(activeNote);
  }, [activeNote, syncPeekNote]);

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
    const noteChanged = syncedNoteIdRef.current !== noteId;
    if (
      !noteChanged &&
      !hasLocalEditRef.current &&
      draftRef.current === noteContent &&
      titleRef.current === (activeNote?.title ?? "")
    )
      return;
    if (
      !noteChanged &&
      (hasLocalEditRef.current || activeSaveSnapshotRef.current)
    )
      return;
    const recoveredDraft = loadEditDraft(noteId);
    if (noteChanged) {
      const legacy = loadLegacyEditDraft(noteId);
      if (legacy && (legacy.title.trim() || legacy.content.trim()))
        toast.warning(
          "An older unsynced draft was found. It was not auto-saved because its original version is unknown.",
          {
            action: {
              label: "Copy draft",
              onClick: () => {
                void navigator.clipboard
                  .writeText(
                    [legacy.title, legacy.content].filter(Boolean).join("\n\n"),
                  )
                  .catch(() => toast.error("Could not copy draft."));
              },
            },
          },
        );
    }
    committedNoteRef.current = activeNote
      ? recoveredDraft
        ? {
            ...activeNote,
            content: recoveredDraft.baseContent,
            title: recoveredDraft.baseTitle,
          }
        : activeNote
      : undefined;
    const nextDraft = recoveredDraft?.content ?? noteContent;
    const nextTitle = recoveredDraft?.title ?? activeNote?.title ?? "";
    const hasRecoveredChanges = Boolean(
      recoveredDraft &&
      (recoveredDraft.content !== noteContent ||
        recoveredDraft.title !== (activeNote?.title ?? "")),
    );
    syncedNoteIdRef.current = noteId;
    draftRef.current = nextDraft;
    titleRef.current = nextTitle;
    editRevisionRef.current += 1;
    hasLocalEditRef.current = hasRecoveredChanges;
    setDraft(nextDraft);
    setTitle(nextTitle);
    setHydratedNoteId(noteId);
    setSaveState(hasRecoveredChanges ? "saving" : "saved");
    failedSaveSnapshotRef.current = undefined;
    if (noteChanged) reset();
  }, [
    activeNote,
    activeNote?.title,
    createdNote?.id,
    isCreateMode,
    noteContent,
    noteId,
    reset,
  ]);

  useEffect(() => {
    const container = noteContentRef.current;
    if (container) container.scrollTop = 0;
  }, [noteId]);

  useEffect(() => {
    if (
      !noteId ||
      activeSaveSnapshotRef.current ||
      hasLocalEditRef.current ||
      draft !== noteContent ||
      (title.trim() || null) !== (activeNote?.title ?? null)
    )
      return;
    clearEditDraft(noteId);
    failedSaveSnapshotRef.current = undefined;
    setSaveState(hasSaveableNote(title, draft) ? "saved" : "empty");
  }, [activeNote?.title, draft, noteContent, noteId, title]);

  const create = useCallback(
    (content: string, nextTitle = title) => {
      if (
        !isCreateMode ||
        activeNote ||
        isCreating ||
        activeSaveSnapshotRef.current
      )
        return;
      const submittedSnapshot: NoteSaveSnapshot = {
        content,
        title: nextTitle,
        revision: editRevisionRef.current,
      };
      if (isNoteContentTooLong(content)) {
        failedSaveSnapshotRef.current = submittedSnapshot;
        setSaveState("error");
        toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
        return;
      }

      activeSaveSnapshotRef.current = submittedSnapshot;
      setSaveState("saving");
      const onSuccess = (data: { note: CollectionNoteNode }) => {
        const nextNote = collectionNodeToAsset(data.note);
        activeSaveSnapshotRef.current = undefined;
        if (nextNote.type !== "note") return;
        clearCreateNoteDraft(createDraftId ?? null);
        setCreatedNote(nextNote);
        committedNoteRef.current = nextNote;
        syncedNoteIdRef.current = nextNote.id;
        const latestSnapshot = getLatestSaveSnapshot();
        if (!hasSaveableNote(latestSnapshot.title, latestSnapshot.content)) {
          queuedSaveSnapshotRef.current = undefined;
          failedSaveSnapshotRef.current = undefined;
          const shouldClose = closeAfterSaveRef.current;
          closeAfterSaveRef.current = false;
          void deleteEmptyNote(nextNote.id, () => {
            if (shouldClose) {
              closeWorkspace();
            } else {
              setCreatedNote(undefined);
              committedNoteRef.current = undefined;
              syncedNoteIdRef.current = undefined;
              setSaveState("empty");
            }
          });
          return;
        }
        const completion = resolveNoteSaveCompletion(
          submittedSnapshot,
          latestSnapshot,
        );
        if (completion.status === "acknowledged") {
          queuedSaveSnapshotRef.current = undefined;
          hasLocalEditRef.current = false;
          clearEditDraft(nextNote.id);
          failedSaveSnapshotRef.current = undefined;
          setSaveState("saved");
          if (closeAfterSaveRef.current) {
            closeAfterSaveRef.current = false;
            closeWorkspace();
          }
          return;
        }

        queuedSaveSnapshotRef.current = completion.snapshot;
        hasLocalEditRef.current = true;
        saveCurrentEditDraft(
          nextNote.id,
          completion.snapshot.content,
          completion.snapshot.title,
        );
        failedSaveSnapshotRef.current = undefined;
        setSaveState("saving");
      };
      const onError = (reason: unknown) => {
        activeSaveSnapshotRef.current = undefined;
        const latestSnapshot = getLatestSaveSnapshot();
        if (!isSameSaveSnapshot(submittedSnapshot, latestSnapshot)) {
          queuedSaveSnapshotRef.current = undefined;
          failedSaveSnapshotRef.current = undefined;
          setSaveState(
            hasSaveableNote(latestSnapshot.title, latestSnapshot.content)
              ? "saving"
              : "empty",
          );
          return;
        }
        failedSaveSnapshotRef.current = submittedSnapshot;
        closeAfterSaveRef.current = false;
        setSaveState("error");
        toast.error(
          getUserFacingApiErrorMessage(reason, "Could not create note."),
        );
      };

      if (createOptions.target === "inbox") {
        createInboxNote.mutate(
          { content, title: nextTitle },
          { onSuccess, onError },
        );
      } else {
        createNote.mutate(
          {
            content,
            title: nextTitle,
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
      closeWorkspace,
      deleteEmptyNote,
      getLatestSaveSnapshot,
      isCreateMode,
      isCreating,
      parentFolderPath,
      saveCurrentEditDraft,
      title,
    ],
  );

  const persist = useCallback(
    (
      content: string,
      closeAfterSave = false,
      nextTitle = title,
      force = false,
    ) => {
      if (!noteId || syncedNoteIdRef.current !== noteId) return;
      const submittedSnapshot: NoteSaveSnapshot = {
        content,
        title: nextTitle,
        revision: editRevisionRef.current,
      };

      if (isNoteContentTooLong(content)) {
        failedSaveSnapshotRef.current = submittedSnapshot;
        closeAfterSaveRef.current = false;
        setSaveState("error");
        toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
        return;
      }

      if (activeSaveSnapshotRef.current || isPending) {
        queuedSaveSnapshotRef.current = submittedSnapshot;
        closeAfterSaveRef.current ||= closeAfterSave;
        return;
      }

      if (!hasSaveableNote(nextTitle, content)) {
        queuedSaveSnapshotRef.current = undefined;
        hasLocalEditRef.current = true;
        saveCurrentEditDraft(noteId, content, nextTitle);
        if (closeAfterSave || closeAfterSaveRef.current) {
          closeAfterSaveRef.current = false;
          void deleteEmptyNote(noteId, closeWorkspace);
        } else {
          setSaveState("empty");
        }
        return;
      }

      if (
        !force &&
        content === committedNoteRef.current?.content &&
        (nextTitle.trim() || null) === (committedNoteRef.current?.title ?? null)
      ) {
        if (isSameSaveSnapshot(submittedSnapshot, getLatestSaveSnapshot())) {
          hasLocalEditRef.current = false;
          queuedSaveSnapshotRef.current = undefined;
          clearEditDraft(noteId);
          setSaveState(hasSaveableNote(nextTitle, content) ? "saved" : "empty");
        }
        if (closeAfterSave) closeWorkspace();
        return;
      }

      const base = committedNoteRef.current;
      if (!base || base.id !== noteId) return;
      closeAfterSaveRef.current ||= closeAfterSave;
      activeSaveSnapshotRef.current = submittedSnapshot;
      setSaveState("saving");
      mutate(
        {
          assetId: noteId,
          content,
          title: nextTitle.trim() || null,
          expectedContent: base.content,
          expectedTitle: base.title ?? null,
        },
        {
          onSuccess: ({ note: updatedNote }) => {
            activeSaveSnapshotRef.current = undefined;
            committedNoteRef.current = { ...base, ...updatedNote };
            setCreatedNote((current) =>
              current?.id === updatedNote.id
                ? { ...current, ...updatedNote }
                : current,
            );
            if (activeNote && onNoteChange) {
              onNoteChange({
                ...activeNote,
                ...updatedNote,
              });
            }
            syncPeekNote({ ...activeNote, ...updatedNote });
            const latestSnapshot = getLatestSaveSnapshot();
            const completion = resolveNoteSaveCompletion(
              submittedSnapshot,
              latestSnapshot,
            );
            if (
              !hasSaveableNote(latestSnapshot.title, latestSnapshot.content)
            ) {
              queuedSaveSnapshotRef.current = undefined;
              hasLocalEditRef.current = true;
              saveCurrentEditDraft(
                noteId,
                latestSnapshot.content,
                latestSnapshot.title,
              );
              failedSaveSnapshotRef.current = undefined;
              if (closeAfterSaveRef.current) {
                closeAfterSaveRef.current = false;
                void deleteEmptyNote(noteId, closeWorkspace);
              } else {
                setSaveState("empty");
              }
              return;
            }
            if (completion.status === "acknowledged") {
              hasLocalEditRef.current = false;
              queuedSaveSnapshotRef.current = undefined;
              clearEditDraft(noteId);
              failedSaveSnapshotRef.current = undefined;
              setSaveState("saved");
              if (closeAfterSaveRef.current) {
                closeAfterSaveRef.current = false;
                closeWorkspace();
              }
              return;
            }

            queuedSaveSnapshotRef.current = completion.snapshot;
            hasLocalEditRef.current = true;
            saveCurrentEditDraft(
              noteId,
              completion.snapshot.content,
              completion.snapshot.title,
            );
            failedSaveSnapshotRef.current = undefined;
            setSaveState("saving");
          },
          onError: (error) => {
            activeSaveSnapshotRef.current = undefined;
            const latestSnapshot = getLatestSaveSnapshot();
            if (!isSameSaveSnapshot(submittedSnapshot, latestSnapshot)) {
              queuedSaveSnapshotRef.current = latestSnapshot;
              hasLocalEditRef.current = true;
              failedSaveSnapshotRef.current = undefined;
              setSaveState("saving");
              return;
            }
            failedSaveSnapshotRef.current = submittedSnapshot;
            closeAfterSaveRef.current = false;
            setSaveState("error");
            toast.error(getNoteSaveErrorMessage(error, "Could not save note."));
          },
        },
      );
    },
    [
      closeWorkspace,
      deleteEmptyNote,
      isPending,
      mutate,
      activeNote,
      getLatestSaveSnapshot,
      noteId,
      onNoteChange,
      saveCurrentEditDraft,
      syncPeekNote,
      title,
    ],
  );

  const prepareCurrentNoteForSwitch = useCallback(async (): Promise<
    NoteAsset | false
  > => {
    if (
      isCreateMode ||
      isPending ||
      activeSaveSnapshotRef.current ||
      !activeNote ||
      syncedNoteIdRef.current !== activeNote.id
    )
      return false;

    const content = draftRef.current;
    if (!hasSaveableNote(titleRef.current, content)) {
      toast.error("Add a title or content before opening another note.");
      return false;
    }
    const submittedSnapshot = getLatestSaveSnapshot();
    if (isNoteContentTooLong(content)) {
      failedSaveSnapshotRef.current = submittedSnapshot;
      setSaveState("error");
      toast.error(NOTE_CONTENT_LIMIT_MESSAGE);
      return false;
    }

    const base = committedNoteRef.current;
    if (!base || base.id !== activeNote.id) return false;
    let currentMainNote = activeNote;
    const nextTitle = titleRef.current.trim() || null;
    const titleChanged = nextTitle !== (base.title ?? null);
    if (content !== base.content || titleChanged) {
      activeSaveSnapshotRef.current = submittedSnapshot;
      setSaveState("saving");
      try {
        const { note: updatedNote } = await mutateAsync({
          assetId: activeNote.id,
          content,
          title: nextTitle,
          expectedContent: base.content,
          expectedTitle: base.title ?? null,
        });
        currentMainNote = {
          ...activeNote,
          ...updatedNote,
        };
        committedNoteRef.current = currentMainNote;
        activeSaveSnapshotRef.current = undefined;
        onNoteChange?.(currentMainNote);
        syncPeekNote(currentMainNote);
        if (!isSameSaveSnapshot(submittedSnapshot, getLatestSaveSnapshot())) {
          const latestSnapshot = getLatestSaveSnapshot();
          queuedSaveSnapshotRef.current = latestSnapshot;
          hasLocalEditRef.current = true;
          saveCurrentEditDraft(
            activeNote.id,
            latestSnapshot.content,
            latestSnapshot.title,
          );
          setSaveState("saving");
          return false;
        }
        hasLocalEditRef.current = false;
        clearEditDraft(activeNote.id);
        setSaveState("saved");
      } catch (error) {
        activeSaveSnapshotRef.current = undefined;
        const latestSnapshot = getLatestSaveSnapshot();
        if (!isSameSaveSnapshot(submittedSnapshot, latestSnapshot)) {
          queuedSaveSnapshotRef.current = latestSnapshot;
          hasLocalEditRef.current = true;
          failedSaveSnapshotRef.current = undefined;
          setSaveState("saving");
          return false;
        }
        failedSaveSnapshotRef.current = submittedSnapshot;
        setSaveState("error");
        toast.error(getNoteSaveErrorMessage(error, "Could not save note."));
        return false;
      }
    }

    return currentMainNote;
  }, [
    activeNote,
    getLatestSaveSnapshot,
    isCreateMode,
    isPending,
    mutateAsync,
    onNoteChange,
    saveCurrentEditDraft,
    syncPeekNote,
  ]);

  useEffect(() => {
    if (!isWorkspaceOpen || !activeNote || isPeekMirror) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!matchesKeybinding(event, PEEK_ASSET_SHORTCUT)) return;
      event.preventDefault();
      event.stopPropagation();
      void (async () => {
        const saved = await prepareCurrentNoteForSwitch();
        if (!saved) return;
        if (await peekNote(saved, location, { demoteMain: true }))
          closeWorkspace();
      })();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeNote,
    closeWorkspace,
    isPeekMirror,
    isWorkspaceOpen,
    location,
    peekNote,
    prepareCurrentNoteForSwitch,
  ]);

  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (
        !activeNote ||
        isCreateMode ||
        controlledOpen === undefined ||
        closeRequestedRef.current ||
        parseWorkspaceAssetPath(current.pathname).assetId !== activeNote.id ||
        parseWorkspaceAssetPath(next.pathname).assetId === activeNote.id
      )
        return false;

      if (!hasSaveableNote(titleRef.current, draftRef.current)) {
        return !(await deleteEmptyNote(activeNote.id, () =>
          setSaveState("empty"),
        ));
      }
      return !(await prepareCurrentNoteForSwitch());
    },
    enableBeforeUnload: false,
  });

  const promotePeekedNote = useCallback(
    async (nextMainNote: NoteAsset) => {
      if (!onPromote || isCreateMode || isPending) return false;
      if (!activeNote) {
        return (await onPromote(nextMainNote)) !== false;
      }
      if (nextMainNote.id === activeNote.id) return false;
      const currentMainNote = await prepareCurrentNoteForSwitch();
      if (!currentMainNote) return false;
      return (await onPromote(nextMainNote, currentMainNote)) !== false;
    },
    [
      activeNote,
      isCreateMode,
      isPending,
      onPromote,
      prepareCurrentNoteForSwitch,
    ],
  );

  const openBacklink = useCallback(
    async (assetId: string) => {
      try {
        const { asset, location: assetLocation } = await fetchPeekableAsset(
          workspaceSlug,
          assetId,
        );
        if (asset.type !== "note") return;
        if (isMobile) await promotePeekedNote(asset);
        else peekNote(asset, assetLocation);
      } catch (error) {
        toast.error(
          getUserFacingApiErrorMessage(error, "Could not open this reference."),
        );
      }
    },
    [isMobile, peekNote, promotePeekedNote, workspaceSlug],
  );

  const openMentionTarget = useCallback(
    async (
      identity: { assetId: number; assetType: "note" | "color" },
      resolved?: NoteMentionTarget,
    ) => {
      try {
        const { asset, location: assetLocation } = await fetchPeekableAsset(
          workspaceSlug,
          `${identity.assetType}-${identity.assetId}`,
        );
        if (asset.type === "note") {
          if (isMobile) await promotePeekedNote(asset);
          else peekNote(asset, assetLocation);
          return;
        }
        if (asset.type !== "color") return;
        if (isMobile) {
          onOpenReferencedColor?.(asset);
          return;
        }
        const scope: PeekColorScope = resolved?.collectionSlug
          ? {
              type: "collection",
              collectionSlug: resolved.collectionSlug,
              folderPath: resolved.folderPath ?? undefined,
              includeDescendants: true,
            }
          : { type: "inbox" };
        peekColor(asset, scope);
      } catch (error) {
        toast.error(
          getUserFacingApiErrorMessage(error, "Could not open this reference."),
        );
      }
    },
    [
      isMobile,
      onOpenReferencedColor,
      peekColor,
      peekNote,
      promotePeekedNote,
      workspaceSlug,
    ],
  );

  useEffect(() => {
    if (!onPromote || isCreateMode) {
      setNotePromotionHandler(undefined);
      setMainNoteLeaveHandler(undefined);
      return;
    }
    setNotePromotionHandler(promotePeekedNote);
    setMainNoteLeaveHandler(async () =>
      Boolean(await prepareCurrentNoteForSwitch()),
    );
    return () => {
      setNotePromotionHandler(undefined);
      setMainNoteLeaveHandler(undefined);
    };
  }, [
    isCreateMode,
    onPromote,
    prepareCurrentNoteForSwitch,
    promotePeekedNote,
    setMainNoteLeaveHandler,
    setNotePromotionHandler,
  ]);

  const swapWithPeekedNote = useCallback(async () => {
    if (
      !activeNote ||
      !onSwap ||
      isCreateMode ||
      isPending ||
      peekTarget?.type !== "note" ||
      peekTarget.asset.id === activeNote.id
    )
      return;

    const nextMainNote = await flushPeekNote(peekTarget.asset.id);
    if (!nextMainNote) return;
    const currentMainNote = await prepareCurrentNoteForSwitch();
    if (!currentMainNote) return;
    if (!(await peekNote(currentMainNote, location, { skipNavigation: true })))
      return;
    if (!(await onSwap(nextMainNote, currentMainNote))) {
      void peekNote(nextMainNote, peekTarget.location ?? location, {
        skipNavigation: true,
      });
    }
  }, [
    activeNote,
    flushPeekNote,
    isCreateMode,
    isPending,
    location,
    onSwap,
    peekNote,
    peekTarget,
    prepareCurrentNoteForSwitch,
  ]);

  useEffect(() => {
    if (
      !activeNote ||
      !onSwap ||
      isCreateMode ||
      peekTarget?.type !== "note" ||
      peekTarget.asset.id === activeNote.id
    ) {
      setNoteSwapHandler(undefined);
      return;
    }
    setNoteSwapHandler(swapWithPeekedNote);
    return () => setNoteSwapHandler(undefined);
  }, [
    activeNote,
    isCreateMode,
    onSwap,
    peekTarget,
    setNoteSwapHandler,
    swapWithPeekedNote,
  ]);

  useEffect(() => {
    if (isCreateMode && !activeNote) {
      if (
        !hasSaveableNote(title, draft) ||
        isCreating ||
        activeSaveSnapshotRef.current
      ) {
        if (!hasSaveableNote(title, draft) && (title.trim() || draft.trim()))
          setSaveState("empty");
        return;
      }
      const latestSnapshot = getLatestSaveSnapshot();
      if (isSameSaveSnapshot(failedSaveSnapshotRef.current, latestSnapshot))
        return;
      const timeout = window.setTimeout(
        () => create(draft, title),
        AUTOSAVE_DELAY_MS,
      );
      return () => window.clearTimeout(timeout);
    }
    if (
      !noteId ||
      syncedNoteIdRef.current !== noteId ||
      isPending ||
      activeSaveSnapshotRef.current
    )
      return;
    const latestSnapshot = getLatestSaveSnapshot();
    const queuedSnapshot = queuedSaveSnapshotRef.current;
    const forceReconciliation = isSameSaveSnapshot(
      queuedSnapshot,
      latestSnapshot,
    );
    const titleChanged =
      (title.trim() || null) !== (committedNoteRef.current?.title ?? null);
    if (
      draft === committedNoteRef.current?.content &&
      !titleChanged &&
      !forceReconciliation
    )
      return;
    if (!hasSaveableNote(title, draft) && !forceReconciliation) {
      setSaveState("empty");
      return;
    }
    if (isSameSaveSnapshot(failedSaveSnapshotRef.current, latestSnapshot))
      return;
    const timeout = window.setTimeout(
      () => {
        if (forceReconciliation) queuedSaveSnapshotRef.current = undefined;
        persist(draft, false, title, forceReconciliation);
      },
      forceReconciliation ? 0 : AUTOSAVE_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [
    activeNote,
    create,
    draft,
    title,
    isCreateMode,
    isCreating,
    isPending,
    getLatestSaveSnapshot,
    noteContent,
    noteId,
    persist,
  ]);

  const updatedTimestamp = activeNote?.updatedAt ?? activeNote?.createdAt;

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
    if (activeNote && syncedNoteIdRef.current !== activeNote.id) return;
    const content = composeFrontMatter(frontMatter, bodyContent);
    editRevisionRef.current += 1;
    draftRef.current = content;
    setDraft(content);
    failedSaveSnapshotRef.current = undefined;
    const latestSnapshot = getLatestSaveSnapshot();
    const saveIsActive = Boolean(
      activeSaveSnapshotRef.current || isPending || isCreating,
    );
    if (activeNote) {
      if (
        !saveIsActive &&
        content === committedNoteRef.current?.content &&
        titleRef.current === (committedNoteRef.current?.title ?? "")
      ) {
        hasLocalEditRef.current = false;
        queuedSaveSnapshotRef.current = undefined;
        clearEditDraft(activeNote.id);
      } else {
        hasLocalEditRef.current = true;
        saveCurrentEditDraft(activeNote.id, content, titleRef.current);
        if (saveIsActive || queuedSaveSnapshotRef.current)
          queuedSaveSnapshotRef.current = latestSnapshot;
      }
    } else if (createDraftId) {
      if (hasSaveableNote(titleRef.current, content) || saveIsActive) {
        saveCreateNoteDraft(createDraftId, {
          content,
          title: titleRef.current,
          open: true,
        });
      } else {
        clearCreateNoteDraft(createDraftId);
      }
    }
  }

  function handleTitleChange(nextTitle: string) {
    if (activeNote && syncedNoteIdRef.current !== activeNote.id) return;
    editRevisionRef.current += 1;
    titleRef.current = nextTitle;
    setTitle(nextTitle);
    failedSaveSnapshotRef.current = undefined;
    const latestSnapshot = getLatestSaveSnapshot();
    const saveIsActive = Boolean(
      activeSaveSnapshotRef.current || isPending || isCreating,
    );
    if (activeNote) {
      if (
        !saveIsActive &&
        draftRef.current === committedNoteRef.current?.content &&
        nextTitle === (committedNoteRef.current?.title ?? "")
      ) {
        hasLocalEditRef.current = false;
        queuedSaveSnapshotRef.current = undefined;
        clearEditDraft(activeNote.id);
      } else {
        hasLocalEditRef.current = true;
        saveCurrentEditDraft(activeNote.id, draftRef.current, nextTitle);
        if (saveIsActive || queuedSaveSnapshotRef.current)
          queuedSaveSnapshotRef.current = latestSnapshot;
      }
    } else if (createDraftId) {
      saveCreateNoteDraft(createDraftId, {
        content: draftRef.current,
        title: nextTitle,
        open: true,
      });
    }
  }

  function requestClose() {
    if (!activeNote) {
      if (
        isCreateMode &&
        (activeSaveSnapshotRef.current ||
          isCreating ||
          hasSaveableNote(titleRef.current, draftRef.current))
      ) {
        closeAfterSaveRef.current = true;
        if (!activeSaveSnapshotRef.current && !isCreating)
          create(draftRef.current, titleRef.current);
        return;
      }
      closeWorkspace();
      return;
    }
    const content = draftRef.current;
    if (activeSaveSnapshotRef.current || updateNote.isPending) {
      closeAfterSaveRef.current = true;
      return;
    }
    if (!hasSaveableNote(titleRef.current, draftRef.current)) {
      void deleteEmptyNote(activeNote.id, closeWorkspace);
      return;
    }
    if (
      content === committedNoteRef.current?.content &&
      (titleRef.current.trim() || null) ===
        (committedNoteRef.current?.title ?? null)
    )
      return closeWorkspace();
    persist(content, true, titleRef.current);
  }

  function requestDismissAll() {
    dismissAllRef.current = true;
    requestClose();
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
      open={isWorkspaceOpen}
      modal={!split}
      disablePointerDismissal={
        (Boolean(peekTarget) && !isMobile) || isPeekResizing
      }
      onOpenChange={(open, details) => {
        if (!open && isPeekResizing) return;
        if (open) {
          closeRequestedRef.current = false;
          setWorkspaceOpen(true);
        } else if (details.reason === "outside-press" && onDismissAll) {
          requestDismissAll();
        } else {
          requestClose();
        }
      }}
      onOpenChangeComplete={(open) => {
        if (
          open ||
          (controlledOpen === undefined && !closeRequestedRef.current)
        )
          return;
        closeRequestedRef.current = false;
        if (isCreateMode) {
          setCreatedNote(undefined);
          setDraft("");
          setTitle("");
          draftRef.current = "";
          titleRef.current = "";
          editRevisionRef.current += 1;
          activeSaveSnapshotRef.current = undefined;
          queuedSaveSnapshotRef.current = undefined;
          failedSaveSnapshotRef.current = undefined;
          hasLocalEditRef.current = false;
          syncedNoteIdRef.current = undefined;
          setSaveState("saved");
        }
        onClose();
      }}
    >
      {children ? <NoteWorkspaceTrigger render={children} /> : null}
      <NoteWorkspaceContent
        backdropClassName={split ? "hidden" : undefined}
        className={cn(
          "transition-[transform,opacity,top,left,right,width,height,max-width,max-height,border-radius,background-color,box-shadow] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          GLASS_FRAME_CLASS,
          expanded
            ? split
              ? "inset-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 rounded-none bg-background shadow-none ring-1 ring-transparent"
              : "top-1/2 left-1/2 right-auto bottom-auto h-dvh w-dvw max-w-none -translate-x-1/2 -translate-y-1/2 rounded-none bg-background shadow-none ring-1 ring-transparent"
            : "top-1/2 left-1/2 right-auto bottom-auto h-[min(52rem,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-[64rem] -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl",
          split &&
            "md:right-[calc(var(--workspace-peek-rail-width)+var(--workspace-peek-stage-gap)+var(--workspace-peek-stage-gap))] md:w-[calc(100dvw-var(--workspace-peek-rail-width)-var(--workspace-peek-stage-gap)-var(--workspace-peek-stage-gap))]",
        )}
      >
        <NoteWorkspaceTitle>
          {activeNote ? "Note" : loading ? "Loading note" : "New note"}
        </NoteWorkspaceTitle>
        <div
          className={cn(
            "relative z-20 flex shrink-0 items-center justify-between gap-3 p-2 text-xs font-medium text-muted-foreground transition-[background-color,border-color,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            expanded
              ? "mt-[var(--app-shell-inset)] mb-[var(--app-shell-inset)] bg-background pl-[calc(var(--app-shell-inset)+0.5rem)]"
              : "bg-transparent",
          )}
        >
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    className={cn(
                      "size-8 rounded-lg",
                      ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
                    )}
                    variant="ghost"
                    size="icon"
                    aria-label="Go back"
                    onClick={onBack ?? requestClose}
                  >
                    <ArrowLeftIcon />
                    <span className="sr-only">Go back</span>
                  </Button>
                }
              />
              <TooltipContent side="bottom">
                <span>Go back</span>
                <KbdGroup className="gap-0.5">
                  <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">Esc</Kbd>
                </KbdGroup>
              </TooltipContent>
            </Tooltip>
            {onDismissAll ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      className={cn(
                        "size-8 rounded-lg",
                        ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
                      )}
                      variant="ghost"
                      size="icon"
                      aria-label="Close all to board"
                      onClick={requestDismissAll}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  Close all to board
                </TooltipContent>
              </Tooltip>
            ) : null}
            {!isPeekMirror ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-8 rounded-lg",
                        ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
                      )}
                      aria-label="Peek note"
                      disabled={!activeNote}
                      onClick={() => {
                        void (async () => {
                          const saved = await prepareCurrentNoteForSwitch();
                          if (!saved) return;
                          if (
                            await peekNote(saved, location, {
                              demoteMain: true,
                            })
                          )
                            closeWorkspace();
                        })();
                      }}
                    >
                      <PanelRightIcon className="size-4" />
                      <span className="sr-only">Peek note</span>
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  <span>Peek note</span>
                  <KbdGroup className="gap-0.5">
                    <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                      {getPlatformAlt()}
                    </Kbd>
                    <span>+</span>
                    <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">
                      {getPlatformShift()}
                    </Kbd>
                    <span>+</span>
                    <Kbd className="h-4 min-w-4 px-0.5 text-[10px]">P</Kbd>
                  </KbdGroup>
                </TooltipContent>
              </Tooltip>
            ) : null}
            {onShowInBoard ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-8 rounded-lg",
                        ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
                      )}
                      aria-label="Show in board"
                      onClick={onShowInBoard}
                    />
                  }
                >
                  <LocateFixedIcon className="size-4" />
                  <span className="sr-only">Show in board</span>
                </TooltipTrigger>
                <TooltipContent side="bottom">Show in board</TooltipContent>
              </Tooltip>
            ) : null}
            {!isMobile && !split ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "size-8 rounded-lg",
                        ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
                      )}
                      aria-label={expanded ? "Exit full screen" : "Full screen"}
                      onClick={toggleExpanded}
                    />
                  }
                >
                  {expanded ? (
                    <Minimize2Icon className="size-4" />
                  ) : (
                    <Maximize2Icon className="size-4" />
                  )}
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {expanded ? "Exit full screen" : "Full screen"}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
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
          <div className="flex min-w-0 items-center justify-end gap-0.5">
            <NoteSaveStatus state={saveState} updatedAt={updatedTimestamp} />
            <NoteHighlightControl
              editorRef={richTextRef}
              color={highlightColor}
              isHighlighting={highlightMode}
              canRemoveHighlight={canRemoveHighlight}
              onColorChange={setHighlightColor}
              onHighlightingChange={handleHighlightModeChange}
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-8 rounded-lg",
                      ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS,
                    )}
                    aria-label={copied ? "Note copied" : "Copy markdown"}
                    onClick={copyNoteMarkdown}
                  >
                    <CopyFeedbackIcon copied={copied} className="size-4" />
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
            <AssetTimestampCard
              createdAt={activeNote?.createdAt}
              updatedAt={activeNote?.updatedAt}
              label="Note details"
              sideOffset={10}
              triggerClassName={ASSET_VIEWER_HEADER_ICON_BUTTON_CLASS}
            />
          </div>
        </div>
        <div
          ref={noteContentRef}
          className={cn(
            "note-workspace-scroll-container min-h-0 flex-1 overflow-y-auto border-t bg-background transition-[border-color,border-radius] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            expanded ? "border-transparent" : "rounded-t-xl border-border",
          )}
        >
          <div className="mx-auto min-h-full w-full max-w-5xl px-5 sm:px-10 lg:px-16 [&_.ProseMirror]:!pt-2">
            {(!isCreateMode && hydratedNoteId !== noteId) ||
            (loading && !activeNote) ? (
              <NoteEditorLoading />
            ) : isCreateMode || activeNote ? (
              <Suspense fallback={<NoteEditorLoading />}>
                <NoteEditorErrorBoundary noteId={activeNote?.id ?? "new-note"}>
                  <NoteTitleField
                    ref={titleInputRef}
                    value={title}
                    onChange={handleTitleChange}
                    onEnter={() => richTextRef.current?.focus()}
                    autoFocus={isCreateMode}
                    readOnly={saveState === "deleting"}
                    className="pt-8"
                  />
                  {!isCreateMode ? (
                    <NoteBacklinks
                      workspaceSlug={workspaceSlug}
                      assetId={activeNote?.id}
                      onOpen={openBacklink}
                    />
                  ) : null}
                  <div>
                    <NoteRichText
                      key={isCreateMode ? "create-note-editor" : activeNote?.id}
                      ref={richTextRef}
                      markdown={frontMatter.body}
                      workspaceSlug={workspaceSlug}
                      sourceNoteId={activeNote?.id}
                      onOpenMention={(identity, resolved) =>
                        void openMentionTarget(identity, resolved)
                      }
                      editable={saveState !== "deleting"}
                      autoFocus={!isCreateMode}
                      scrollContainerRef={noteContentRef}
                      onExtractSelection={
                        noteExtractionTarget ? extractSelection : undefined
                      }
                      highlightColor={highlightColor}
                      highlightMode={highlightMode}
                      onHighlightModeChange={handleHighlightModeChange}
                      onHighlightSelectionChange={setCanRemoveHighlight}
                      onChange={handleDraftChange}
                      onSaveShortcut={() => {
                        const content = getSaveableNoteContent(
                          draftRef.current,
                        );
                        if (!content) return;
                        if (isCreateMode && !activeNote) create(content, title);
                        else persist(content, false, title);
                      }}
                    />
                  </div>
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

function isPageReload(): boolean {
  if (typeof performance === "undefined") return false;
  const navigation = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return navigation?.type === "reload";
}
