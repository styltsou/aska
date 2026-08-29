import { describe, expect, it } from "vitest";

import { getNoteSaveStatusLabel } from "./note-save-status";

const NOW = Date.parse("2026-08-29T12:00:00.000Z");

describe("getNoteSaveStatusLabel", () => {
  it("uses a persistent relative edit label after saving", () => {
    expect(
      getNoteSaveStatusLabel("saved", "2026-08-29T11:57:00.000Z", NOW),
    ).toBe("Edited 3m ago");
  });

  it("overrides the edit label for active and failure states", () => {
    expect(getNoteSaveStatusLabel("saving", undefined, NOW)).toBe("Saving…");
    expect(getNoteSaveStatusLabel("error", undefined, NOW)).toBe("Save failed");
    expect(getNoteSaveStatusLabel("empty", undefined, NOW)).toBeUndefined();
  });
});
