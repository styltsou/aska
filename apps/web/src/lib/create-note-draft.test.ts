import { afterEach, describe, expect, it, vi } from "vitest";

import { getCreateNoteDraftId, saveCreateNoteDraft } from "./create-note-draft";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("create note draft cleanup", () => {
  it("prunes expired drafts without touching recent drafts or other session data", () => {
    const values = new Map<string, string>();
    const sessionStorage = {
      get length() {
        return values.size;
      },
      key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal("window", { sessionStorage });
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(0);
    const oldId = getCreateNoteDraftId("space", "old", "collection")!;
    saveCreateNoteDraft(oldId, { content: "Old", open: false });
    now.mockReturnValue(31 * 60 * 1_000);
    const recentId = getCreateNoteDraftId("space", "recent", "collection")!;
    saveCreateNoteDraft(recentId, { content: "Recent", open: true });
    values.set("unrelated", "keep");

    getCreateNoteDraftId("space", "another", "collection");

    expect(values.has(oldId)).toBe(false);
    expect(values.has(recentId)).toBe(true);
    expect(values.get("unrelated")).toBe("keep");
  });
});
