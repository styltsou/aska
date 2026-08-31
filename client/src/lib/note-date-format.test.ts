import { describe, expect, it } from "vitest";

import {
  formatNoteHeaderEditTime,
  formatNoteMetadataDateTime,
} from "./note-date-format";

const NOW = new Date(2026, 7, 31, 12).getTime();
const EDITED_AT = new Date(2026, 7, 29, 11, 57).toISOString();

describe("note date formatting", () => {
  it("uses relative time in the header", () => {
    const editedAt = new Date(2026, 7, 31, 11, 57).toISOString();
    expect(formatNoteHeaderEditTime(editedAt, NOW)).toBe("3m ago");
  });

  it("uses the full date and time in metadata", () => {
    expect(formatNoteMetadataDateTime(EDITED_AT)).toBe(
      "Aug 29, 2026, 11:57 AM",
    );
  });
});
