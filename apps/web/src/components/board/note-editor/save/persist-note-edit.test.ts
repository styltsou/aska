import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { loadEditDraft, saveEditDraft } from "@/lib/note-edit-draft";
import type { NoteAsset } from "@/types/asset";
import { persistNoteEdit } from "./persist-note-edit";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
});
beforeEach(() => storage.clear());

function setup() {
  const note: NoteAsset = {
    id: "note-1",
    type: "note",
    content: "Original",
    title: "Title",
  };
  const mutate = vi.fn();
  const options: Parameters<typeof persistNoteEdit>[0] = {
    noteId: note.id,
    activeNote: note,
    isPending: false,
    syncedNoteIdRef: { current: note.id },
    conflictRef: { current: false },
    editRevisionRef: { current: 1 },
    failedSaveSnapshotRef: { current: undefined },
    activeSaveSnapshotRef: { current: undefined },
    queuedSaveSnapshotRef: { current: undefined },
    closeAfterSaveRef: { current: false },
    hasLocalEditRef: { current: true },
    committedNoteRef: { current: note },
    draftRef: { current: "Edited" },
    titleRef: { current: "Title" },
    getLatestSaveSnapshot: () => ({
      content: options.draftRef.current,
      title: options.titleRef.current,
      revision: options.editRevisionRef.current,
    }),
    mutate: mutate as typeof options.mutate,
    setSaveState: vi.fn(),
    setServerNote: vi.fn(),
    setCreatedNote: vi.fn(),
    saveCurrentEditDraft: vi.fn((id, content, title) =>
      saveEditDraft(
        id,
        content,
        title,
        options.committedNoteRef.current!.content,
        options.committedNoteRef.current!.title ?? null,
      ),
    ),
    deleteEmptyNote: vi.fn(async () => true),
    closeWorkspace: vi.fn(),
    onNoteChange: vi.fn(),
    syncPeekNote: vi.fn(),
  };
  const save = (close = false) =>
    persistNoteEdit(
      options,
      options.draftRef.current,
      close,
      options.titleRef.current,
      false,
    );
  const callbacks = () =>
    mutate.mock.calls[0]![1] as {
      onSuccess: (value: { note: NoteAsset }) => void;
      onError: (error: unknown) => void;
    };
  return { note, options, mutate, save, callbacks };
}

describe("saving note edits", () => {
  it("saves against the committed version and closes only after acknowledgement", () => {
    const { note, options, mutate, save, callbacks } = setup();
    saveEditDraft(note.id, "Edited", "Title", note.content, note.title ?? null);
    save(true);
    expect(options.closeWorkspace).not.toHaveBeenCalled();
    expect(mutate.mock.calls[0]![0]).toEqual({
      assetId: note.id,
      content: "Edited",
      title: "Title",
      expectedContent: "Original",
      expectedTitle: "Title",
    });
    callbacks().onSuccess({ note: { ...note, content: "Edited" } });
    expect(loadEditDraft(note.id)).toBeUndefined();
    expect(options.closeWorkspace).toHaveBeenCalledOnce();
    expect(options.setSaveState).toHaveBeenLastCalledWith("saved");
  });
  it("keeps newer edits queued and does not close when an older save completes", () => {
    const { note, options, save, callbacks } = setup();
    save(true);
    options.draftRef.current = "Newer";
    options.editRevisionRef.current++;
    callbacks().onSuccess({ note: { ...note, content: "Edited" } });
    expect(options.queuedSaveSnapshotRef.current).toEqual({
      content: "Newer",
      title: "Title",
      revision: 2,
    });
    expect(loadEditDraft(note.id)?.content).toBe("Newer");
    expect(options.closeWorkspace).not.toHaveBeenCalled();
    expect(options.setSaveState).toHaveBeenLastCalledWith("saving");
  });
  it("queues edits submitted while a save is in flight", () => {
    const { options, mutate, save } = setup();
    save();
    options.draftRef.current = "Newer";
    options.editRevisionRef.current++;
    save(true);
    expect(mutate).toHaveBeenCalledOnce();
    expect(options.queuedSaveSnapshotRef.current?.content).toBe("Newer");
    expect(options.closeAfterSaveRef.current).toBe(true);
  });
  it("preserves the newest draft and enters conflict state when save conflicts", () => {
    const { note, options, save, callbacks } = setup();
    save(true);
    options.draftRef.current = "Newer";
    callbacks().onError(new ApiError(409, "Conflict", "conflict"));
    expect(options.conflictRef.current).toBe(true);
    expect(loadEditDraft(note.id)?.content).toBe("Newer");
    expect(options.closeAfterSaveRef.current).toBe(false);
    expect(options.setSaveState).toHaveBeenLastCalledWith("conflict");
  });
  it("records a network failure without discarding the draft", () => {
    const { options, save, callbacks } = setup();
    save(true);
    callbacks().onError(new Error("offline"));
    expect(options.failedSaveSnapshotRef.current?.content).toBe("Edited");
    expect(options.closeWorkspace).not.toHaveBeenCalled();
    expect(options.setSaveState).toHaveBeenLastCalledWith("error");
  });
  it("keeps an empty draft without saving and deletes it only when closing", () => {
    const { options, mutate, save } = setup();
    options.draftRef.current = "";
    options.titleRef.current = "";
    save();
    expect(options.setSaveState).toHaveBeenLastCalledWith("empty");
    expect(mutate).not.toHaveBeenCalled();
    save(true);
    expect(options.deleteEmptyNote).toHaveBeenCalledWith(
      "note-1",
      options.closeWorkspace,
    );
  });
});
