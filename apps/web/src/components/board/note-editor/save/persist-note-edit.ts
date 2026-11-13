import type { Dispatch, SetStateAction } from "react";
import type { useUpdateNote } from "@/api/collection";
import { toast } from "sonner";
import type { NoteAsset } from "@/types/asset";
import {
  hasSaveableNote,
  isNoteContentTooLong,
  NOTE_CONTENT_LIMIT_MESSAGE,
} from "@/lib/note-content";
import {
  clearEditDraft,
  getNoteSaveErrorMessage,
  isNoteEditConflict,
} from "@/lib/note-edit-draft";
import {
  isSameSaveSnapshot,
  resolveNoteSaveCompletion,
  type NoteSaveSnapshot,
} from "./note-save-reconciliation";

type Ref<T> = { current: T };
type PersistOptions = {
  noteId: string | undefined;
  activeNote: NoteAsset | undefined;
  isPending: boolean;
  syncedNoteIdRef: Ref<string | undefined>;
  conflictRef: Ref<boolean>;
  editRevisionRef: Ref<number>;
  failedSaveSnapshotRef: Ref<NoteSaveSnapshot | undefined>;
  activeSaveSnapshotRef: Ref<NoteSaveSnapshot | undefined>;
  queuedSaveSnapshotRef: Ref<NoteSaveSnapshot | undefined>;
  closeAfterSaveRef: Ref<boolean>;
  hasLocalEditRef: Ref<boolean>;
  committedNoteRef: Ref<NoteAsset | undefined>;
  draftRef: Ref<string>;
  titleRef: Ref<string>;
  getLatestSaveSnapshot: () => NoteSaveSnapshot;
  mutate: ReturnType<typeof useUpdateNote>["mutate"];
  setSaveState: (
    state: "saving" | "saved" | "empty" | "error" | "conflict",
  ) => void;
  setServerNote: (note: NoteAsset | undefined) => void;
  setCreatedNote: Dispatch<SetStateAction<NoteAsset | undefined>>;
  saveCurrentEditDraft: (id: string, content: string, title: string) => void;
  deleteEmptyNote: (id: string, onDeleted: () => void) => Promise<boolean>;
  closeWorkspace: () => void;
  onNoteChange?: (note: NoteAsset) => void;
  syncPeekNote: (note: NoteAsset) => void;
};

export function persistNoteEdit(
  {
    noteId,
    activeNote,
    isPending,
    syncedNoteIdRef,
    conflictRef,
    editRevisionRef,
    failedSaveSnapshotRef,
    activeSaveSnapshotRef,
    queuedSaveSnapshotRef,
    closeAfterSaveRef,
    hasLocalEditRef,
    committedNoteRef,
    draftRef,
    titleRef,
    getLatestSaveSnapshot,
    mutate,
    setSaveState,
    setServerNote,
    setCreatedNote,
    saveCurrentEditDraft,
    deleteEmptyNote,
    closeWorkspace,
    onNoteChange,
    syncPeekNote,
  }: PersistOptions,
  content: string,
  closeAfterSave: boolean,
  nextTitle: string,
  force: boolean,
): void {
  if (!noteId || syncedNoteIdRef.current !== noteId) return;
  if (conflictRef.current) {
    toast.error("Compare versions before saving your edits.");
    return;
  }
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
      clearEditDraft(noteId, committedNoteRef.current);
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
        conflictRef.current = false;
        setServerNote(undefined);
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
        if (!hasSaveableNote(latestSnapshot.title, latestSnapshot.content)) {
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
          clearEditDraft(noteId, updatedNote);
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
        if (isNoteEditConflict(error)) {
          conflictRef.current = true;
          queuedSaveSnapshotRef.current = undefined;
          failedSaveSnapshotRef.current = undefined;
          closeAfterSaveRef.current = false;
          saveCurrentEditDraft(noteId, draftRef.current, titleRef.current);
          setServerNote(undefined);
          setSaveState("conflict");
          toast.error(getNoteSaveErrorMessage(error, "Could not save note."));
          return;
        }
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
}
