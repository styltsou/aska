import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { loadEditDraft, saveEditDraft } from "@/lib/note-edit-draft";
import type { NoteAsset } from "@/types/asset";
import { prepareNoteForSwitch } from "./prepare-note-for-switch";

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
  let revision = 1;
  const mutate = vi.fn();
  const options: Parameters<typeof prepareNoteForSwitch>[0] = {
    activeNote: note,
    isCreateMode: false,
    isPending: false,
    conflictRef: { current: false },
    activeSaveSnapshotRef: { current: undefined },
    queuedSaveSnapshotRef: { current: undefined },
    failedSaveSnapshotRef: { current: undefined },
    syncedNoteIdRef: { current: note.id },
    committedNoteRef: { current: note },
    draftRef: { current: "Edited" },
    titleRef: { current: "Title" },
    hasLocalEditRef: { current: true },
    getLatestSaveSnapshot: () => ({
      content: options.draftRef.current,
      title: options.titleRef.current,
      revision,
    }),
    mutateAsync: mutate as Parameters<
      typeof prepareNoteForSwitch
    >[0]["mutateAsync"],
    setSaveState: vi.fn(),
    setServerNote: vi.fn(),
    onNoteChange: vi.fn(),
    syncPeekNote: vi.fn(),
    saveCurrentEditDraft: vi.fn((id, content, title) =>
      saveEditDraft(id, content, title, note.content, note.title ?? null),
    ),
  };
  return {
    note,
    options,
    mutate,
    edit(content: string) {
      options.draftRef.current = content;
      revision++;
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("preparing a note for switching", () => {
  it("saves against the committed version and clears the draft", async () => {
    const { note, options, mutate } = setup();
    saveEditDraft(note.id, "Edited", "Title", note.content, note.title ?? null);
    mutate.mockResolvedValue({ note: { ...note, content: "Edited" } });
    expect(await prepareNoteForSwitch(options)).toMatchObject({
      id: note.id,
      content: "Edited",
    });
    expect(mutate).toHaveBeenCalledWith({
      assetId: note.id,
      content: "Edited",
      title: "Title",
      expectedContent: "Original",
      expectedTitle: "Title",
    });
    expect(loadEditDraft(note.id)).toBeUndefined();
    expect(options.hasLocalEditRef.current).toBe(false);
    expect(options.setSaveState).toHaveBeenLastCalledWith("saved");
  });
  it("retains a newer edit and blocks switching when a save completes", async () => {
    const { note, options, mutate, edit } = setup();
    const pending = deferred<{ note: NoteAsset }>();
    mutate.mockReturnValue(pending.promise);
    const switching = prepareNoteForSwitch(options);
    expect(options.activeSaveSnapshotRef.current?.content).toBe("Edited");
    edit("Newer edit");
    pending.resolve({ note: { ...note, content: "Edited" } });
    expect(await switching).toBe(false);
    expect(options.queuedSaveSnapshotRef.current).toEqual({
      content: "Newer edit",
      title: "Title",
      revision: 2,
    });
    expect(loadEditDraft(note.id)?.content).toBe("Newer edit");
    expect(options.activeSaveSnapshotRef.current).toBeUndefined();
    expect(options.setSaveState).toHaveBeenLastCalledWith("saving");
  });
  it("preserves the current draft and blocks switching on conflict", async () => {
    const { note, options, mutate } = setup();
    mutate.mockRejectedValue(new ApiError(409, "Conflict", "conflict"));
    expect(await prepareNoteForSwitch(options)).toBe(false);
    expect(options.conflictRef.current).toBe(true);
    expect(loadEditDraft(note.id)?.content).toBe("Edited");
    expect(options.setSaveState).toHaveBeenLastCalledWith("conflict");
  });
  it("records a failed save and blocks switching on network error", async () => {
    const { options, mutate } = setup();
    mutate.mockRejectedValue(new Error("offline"));
    expect(await prepareNoteForSwitch(options)).toBe(false);
    expect(options.failedSaveSnapshotRef.current).toEqual({
      content: "Edited",
      title: "Title",
      revision: 1,
    });
    expect(options.setSaveState).toHaveBeenLastCalledWith("error");
  });
  it("queues newer edits when a save fails after another edit", async () => {
    const { options, mutate, edit } = setup();
    const pending = deferred<{ note: NoteAsset }>();
    mutate.mockReturnValue(pending.promise);
    const switching = prepareNoteForSwitch(options);
    edit("Newer edit");
    pending.reject(new Error("offline"));
    expect(await switching).toBe(false);
    expect(options.queuedSaveSnapshotRef.current?.content).toBe("Newer edit");
    expect(options.setSaveState).toHaveBeenLastCalledWith("saving");
  });
  it.each([
    "conflict",
    "pending",
    "active-save",
    "wrong-note",
    "empty",
    "too-long",
  ] as const)("blocks %s without submitting", async (reason) => {
    const { options, mutate } = setup();
    if (reason === "conflict") options.conflictRef.current = true;
    if (reason === "pending") options.isPending = true;
    if (reason === "active-save")
      options.activeSaveSnapshotRef.current = {
        content: "x",
        title: "",
        revision: 0,
      };
    if (reason === "wrong-note") options.syncedNoteIdRef.current = "note-2";
    if (reason === "empty") {
      options.draftRef.current = "";
      options.titleRef.current = "";
    }
    if (reason === "too-long") options.draftRef.current = "x".repeat(100_001);
    expect(await prepareNoteForSwitch(options)).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
  });
  it("returns an unchanged note without sending a save", async () => {
    const { note, options, mutate } = setup();
    options.draftRef.current = note.content;
    expect(await prepareNoteForSwitch(options)).toEqual(note);
    expect(mutate).not.toHaveBeenCalled();
  });
});
