import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearEditDraft,
  getNoteSaveErrorMessage,
  loadEditDraft,
  loadLegacyEditDraft,
  saveEditDraft,
} from "./note-edit-draft";
import { ApiError } from "@/lib/api";

const values = new Map<string, string>();
vi.stubGlobal("localStorage", {
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

  it("explains a concurrent edit without implying the draft was saved", () => {
    expect(
      getNoteSaveErrorMessage(
        new ApiError(409, "Concurrent edit", "conflict"),
        "Could not save note.",
      ),
    ).toContain("copy it before reloading");
  });
});
