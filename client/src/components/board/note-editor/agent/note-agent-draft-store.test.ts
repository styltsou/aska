import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearNoteAgentDraft,
  loadNoteAgentDraft,
  saveNoteAgentDraft,
  type StoredNoteAgentDraft,
} from "./note-agent-draft-store";

const draft: StoredNoteAgentDraft = {
  baseMarkdown: "Intro\n\n",
  blockIndex: 1,
  draft: "A draft",
  request: { prompt: "write", note: "Intro\n\n⟦cursor⟧" },
  savedAt: 1_000,
};

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("note agent draft store", () => {
  it("round-trips a draft per note", () => {
    saveNoteAgentDraft("note-1", draft);
    expect(loadNoteAgentDraft("note-1", 2_000)).toEqual(draft);
    expect(loadNoteAgentDraft("note-2", 2_000)).toBeNull();
    clearNoteAgentDraft("note-1");
    expect(loadNoteAgentDraft("note-1", 2_000)).toBeNull();
  });

  it("drops drafts older than two weeks", () => {
    saveNoteAgentDraft("note-1", draft);
    const later = draft.savedAt + 15 * 24 * 60 * 60 * 1000;
    expect(loadNoteAgentDraft("note-1", later)).toBeNull();
    expect(loadNoteAgentDraft("note-1", draft.savedAt)).toBeNull();
  });

  it("ignores malformed entries and unavailable storage", () => {
    window.localStorage.setItem("mnemee:note-ai-draft:v1:note-1", "{nope");
    expect(loadNoteAgentDraft("note-1")).toBeNull();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
        removeItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => saveNoteAgentDraft("note-1", draft)).not.toThrow();
    expect(loadNoteAgentDraft("note-1")).toBeNull();
    expect(() => clearNoteAgentDraft("note-1")).not.toThrow();
  });
});
