import { describe, expect, it } from "vitest";

import type { PeekableAssetResponse, UpdatedNote } from "./types";
import { applySavedNoteToWorkspaceAsset } from "./note-asset-cache";

const cached: PeekableAssetResponse = {
  asset: {
    id: "note-1",
    type: "note",
    content: "Old body",
    title: "Old title",
    isFavorite: false,
    wordCount: 2,
    readingTimeMinutes: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    position: null,
  },
  location: { type: "inbox" },
};
const saved: UpdatedNote = {
  id: "note-1",
  type: "note",
  content: "New body",
  title: "New title",
  isFavorite: false,
  isExpanded: false,
  wordCount: 2,
  readingTimeMinutes: 1,
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("workspace note asset cache", () => {
  it("updates the note body while preserving its board location", () => {
    expect(applySavedNoteToWorkspaceAsset(cached, saved)).toEqual({
      ...cached,
      asset: { ...cached.asset, ...saved },
    });
  });

  it("never applies a saved body to another note", () => {
    const other = {
      ...cached,
      asset: { ...cached.asset, id: "note-2" },
    } as PeekableAssetResponse;
    expect(applySavedNoteToWorkspaceAsset(other, saved)).toBe(other);
  });
});
