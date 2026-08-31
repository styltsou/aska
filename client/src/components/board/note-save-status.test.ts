import { describe, expect, it } from "vitest";

import { getNoteSaveStatusLabel } from "./note-save-status";

const NOW = new Date(2026, 7, 31, 12).getTime();
const EDITED_AT = new Date(2026, 7, 29, 11, 57).toISOString();

describe("getNoteSaveStatusLabel", () => {
  it("uses a relative edit label after saving", () => {
    expect(getNoteSaveStatusLabel("saved", EDITED_AT, NOW)).toBe(
      "Edited 2d ago",
    );
  });

  it("overrides the edit label for active and failure states", () => {
    expect(getNoteSaveStatusLabel("saving", undefined)).toBe("Saving…");
    expect(getNoteSaveStatusLabel("error", undefined)).toBe("Save failed");
    expect(getNoteSaveStatusLabel("empty", undefined)).toBeUndefined();
  });
});
