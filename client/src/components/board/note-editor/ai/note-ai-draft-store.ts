import type { NoteAiRequest } from "@/components/board/note-editor/ai/note-ai-stream";

/**
 * A pending AI draft lives beside its note (not in it) until it is kept, so
 * it survives refreshes and restarts on this device. It is only restored when
 * the note is still exactly what it was around the draft.
 */
export type StoredNoteAiDraft = {
  /** The note without the draft; restoring requires an exact match. */
  baseMarkdown: string;
  /** Top-level block (an empty line) the draft was written on. */
  blockIndex: number;
  draft: string;
  request: NoteAiRequest;
  savedAt: number;
};

const KEY_PREFIX = "aska:note-ai-draft:v1:";
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function key(noteId: string) {
  return `${KEY_PREFIX}${noteId}`;
}

function isStoredDraft(value: unknown): value is StoredNoteAiDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<StoredNoteAiDraft>;
  return (
    typeof draft.baseMarkdown === "string" &&
    typeof draft.blockIndex === "number" &&
    typeof draft.draft === "string" &&
    typeof draft.savedAt === "number" &&
    typeof draft.request?.prompt === "string" &&
    typeof draft.request?.note === "string"
  );
}

export function loadNoteAiDraft(
  noteId: string,
  now = Date.now(),
): StoredNoteAiDraft | null {
  try {
    const raw = window.localStorage.getItem(key(noteId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredDraft(parsed) || now - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key(noteId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveNoteAiDraft(noteId: string, draft: StoredNoteAiDraft) {
  try {
    window.localStorage.setItem(key(noteId), JSON.stringify(draft));
  } catch {
    // Storage can be full or blocked; the draft still works for this visit.
  }
}

export function clearNoteAiDraft(noteId: string) {
  try {
    window.localStorage.removeItem(key(noteId));
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
