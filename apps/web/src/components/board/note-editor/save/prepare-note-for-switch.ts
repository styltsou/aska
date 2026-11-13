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
  type NoteSaveSnapshot,
} from "./note-save-reconciliation";

type Ref<T> = { current: T };
type SwitchOptions = {
  activeNote: NoteAsset | undefined;
  isCreateMode: boolean;
  isPending: boolean;
  conflictRef: Ref<boolean>;
  activeSaveSnapshotRef: Ref<NoteSaveSnapshot | undefined>;
  queuedSaveSnapshotRef: Ref<NoteSaveSnapshot | undefined>;
  failedSaveSnapshotRef: Ref<NoteSaveSnapshot | undefined>;
  syncedNoteIdRef: Ref<string | undefined>;
  committedNoteRef: Ref<NoteAsset | undefined>;
  draftRef: Ref<string>;
  titleRef: Ref<string>;
  hasLocalEditRef: Ref<boolean>;
  getLatestSaveSnapshot: () => NoteSaveSnapshot;
  mutateAsync: ReturnType<typeof useUpdateNote>["mutateAsync"];
  setSaveState: (state: "saving" | "saved" | "error" | "conflict") => void;
  setServerNote: (note: NoteAsset | undefined) => void;
  onNoteChange?: (note: NoteAsset) => void;
  syncPeekNote: (note: NoteAsset) => void;
  saveCurrentEditDraft: (id: string, content: string, title: string) => void;
};

export async function prepareNoteForSwitch({
  activeNote,
  isCreateMode,
  isPending,
  conflictRef,
  activeSaveSnapshotRef,
  queuedSaveSnapshotRef,
  failedSaveSnapshotRef,
  syncedNoteIdRef,
  committedNoteRef,
  draftRef,
  titleRef,
  hasLocalEditRef,
  getLatestSaveSnapshot,
  mutateAsync,
  setSaveState,
  setServerNote,
  onNoteChange,
  syncPeekNote,
  saveCurrentEditDraft,
}: SwitchOptions): Promise<NoteAsset | false> {
  if (
    conflictRef.current ||
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
      clearEditDraft(activeNote.id, currentMainNote);
      setSaveState("saved");
    } catch (error) {
      activeSaveSnapshotRef.current = undefined;
      if (isNoteEditConflict(error)) {
        conflictRef.current = true;
        queuedSaveSnapshotRef.current = undefined;
        saveCurrentEditDraft(activeNote.id, draftRef.current, titleRef.current);
        setServerNote(undefined);
        setSaveState("conflict");
        toast.error(getNoteSaveErrorMessage(error, "Could not save note."));
        return false;
      }
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
}
