import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearEditDraft,
  clearDeletedNoteDrafts,
  getNoteSaveErrorMessage,
  isEditDraftStale,
  isNoteEditConflict,
  loadEditDraft,
  loadLegacyEditDraft,
  pruneRedundantEditDrafts,
  saveEditDraft,
} from "./note-edit-draft";
import { ApiError } from "@/lib/api";

const values = new Map<string, string>();
vi.stubGlobal("localStorage", {
  get length() {
    return values.size;
  },
  key: (index: number) => [...values.keys()][index] ?? null,
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
});

afterEach(() => values.clear());

describe("note edit draft ownership", () => {
  it("restores a draft only for its owning note", () => {
    saveEditDraft(
      "note-1",
      "First body",
      "First title",
      "Old body",
      "Old title",
    );
    expect(loadEditDraft("note-1")).toEqual({
      content: "First body",
      title: "First title",
      baseContent: "Old body",
      baseTitle: "Old title",
    });
    expect(loadEditDraft("note-2")).toBeUndefined();
  });

  it("does not silently replay an unowned legacy draft", () => {
    const key = "aska.edit-note-draft:note-1";
    values.set(key, JSON.stringify({ content: "Possibly stale", title: "" }));
    expect(loadEditDraft("note-1")).toBeUndefined();
    expect(loadLegacyEditDraft("note-1")?.content).toBe("Possibly stale");
    expect(values.get(key)).toContain("Possibly stale");
  });

  it("does not replay an owned draft without its original server version", () => {
    const key = "aska.edit-note-draft:note-1";
    values.set(
      key,
      JSON.stringify({ noteId: "note-1", content: "Older edit", title: "" }),
    );
    expect(loadEditDraft("note-1")).toBeUndefined();
    clearEditDraft("note-1");
    expect(values.get(key)).toContain("Older edit");
    saveEditDraft("note-1", "New edit", "", "Server body", null);
    expect(loadLegacyEditDraft("note-1")?.content).toBe("Older edit");
    expect(loadEditDraft("note-1")?.content).toBe("New edit");
  });

  it("clears only the requested note draft", () => {
    saveEditDraft("note-1", "First", "", "", null);
    saveEditDraft("note-2", "Second", "", "", null);
    clearEditDraft("note-1");
    expect(loadEditDraft("note-1")).toBeUndefined();
    expect(loadEditDraft("note-2")?.content).toBe("Second");
  });

  it("removes an old backup only when its contents were confirmed on the server", () => {
    values.set(
      "aska.edit-note-draft-legacy:note-1",
      JSON.stringify({ content: "Older edit", title: "Title" }),
    );
    saveEditDraft("note-1", "New edit", "Title", "Server body", "Title");
    clearEditDraft("note-1", { content: "New edit", title: "Title" });
    expect(loadEditDraft("note-1")).toBeUndefined();
    expect(loadLegacyEditDraft("note-1")?.content).toBe("Older edit");

    clearEditDraft("note-1", { content: "Older edit", title: "Title" });
    expect(loadLegacyEditDraft("note-1")).toBeUndefined();
  });

  it("removes a redundant backup when a new draft carries the same text", () => {
    values.set(
      "aska.edit-note-draft:note-1",
      JSON.stringify({ content: "My edit", title: "Title" }),
    );
    saveEditDraft("note-1", "My edit", "Title", "Server body", "Title");
    expect(loadEditDraft("note-1")?.content).toBe("My edit");
    expect(values.has("aska.edit-note-draft-legacy:note-1")).toBe(false);
  });

  it("drops empty old-format backups", () => {
    values.set(
      "aska.edit-note-draft-legacy:note-1",
      JSON.stringify({ content: "", title: "" }),
    );
    expect(loadLegacyEditDraft("note-1")).toBeUndefined();
    expect(values.has("aska.edit-note-draft-legacy:note-1")).toBe(false);
  });

  it("prunes redundant backups across notes while preserving distinct drafts", () => {
    saveEditDraft("note-1", "Unsaved", "", "Server", null);
    values.set(
      "aska.edit-note-draft-legacy:note-1",
      JSON.stringify({ content: "Unsaved", title: "" }),
    );
    values.set(
      "aska.edit-note-draft-legacy:note-2",
      JSON.stringify({ content: "Different unsaved text", title: "" }),
    );
    values.set(
      "aska.edit-note-draft-legacy:note-3",
      JSON.stringify({ content: "", title: "" }),
    );
    values.set("unrelated", "keep");

    pruneRedundantEditDrafts();

    expect(values.has("aska.edit-note-draft-legacy:note-1")).toBe(false);
    expect(loadEditDraft("note-1")?.content).toBe("Unsaved");
    expect(loadLegacyEditDraft("note-2")?.content).toBe(
      "Different unsaved text",
    );
    expect(values.has("aska.edit-note-draft-legacy:note-3")).toBe(false);
    expect(values.get("unrelated")).toBe("keep");
  });

  it("clears both drafts after a confirmed deletion", () => {
    values.set(
      "aska.edit-note-draft-legacy:note-1",
      JSON.stringify({ content: "Older edit", title: "" }),
    );
    saveEditDraft("note-1", "Current edit", "", "Server body", null);
    clearDeletedNoteDrafts("note-1");
    expect(loadLegacyEditDraft("note-1")).toBeUndefined();
    expect(loadEditDraft("note-1")).toBeUndefined();
  });

  it("explains a concurrent edit without implying the draft was saved", () => {
    const conflict = new ApiError(409, "Concurrent edit", "conflict");
    expect(getNoteSaveErrorMessage(conflict, "Could not save note.")).toContain(
      "Compare versions",
    );
    expect(isNoteEditConflict(conflict)).toBe(true);
    expect(isNoteEditConflict(new Error("Offline"))).toBe(false);
  });

  it("detects when a recovered draft started from an older server note", () => {
    const draft = {
      content: "My next edit",
      title: "My title",
      baseContent: "Original",
      baseTitle: null,
    };
    expect(isEditDraftStale(draft, { content: "Original", title: null })).toBe(
      false,
    );
    expect(
      isEditDraftStale(draft, { content: "Saved in flight", title: null }),
    ).toBe(true);
    expect(
      isEditDraftStale(draft, { content: "Original", title: "New title" }),
    ).toBe(true);
  });
});
