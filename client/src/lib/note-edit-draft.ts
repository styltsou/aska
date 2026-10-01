import { ApiError, getUserFacingApiErrorMessage } from "@/lib/api";

export type EditNoteDraft = {
  content: string;
  title: string;
  baseContent: string;
  baseTitle: string | null;
};

const EDIT_DRAFT_PREFIX = "aska.edit-note-draft:";
const LEGACY_DRAFT_PREFIX = "aska.edit-note-draft-legacy:";
const editDraftKey = (noteId: string) => `${EDIT_DRAFT_PREFIX}${noteId}`;
const legacyDraftKey = (noteId: string) => `${LEGACY_DRAFT_PREFIX}${noteId}`;
let prunedRedundantDrafts = false;

export function pruneRedundantEditDrafts() {
  if (prunedRedundantDrafts) return;
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(LEGACY_DRAFT_PREFIX)) {
        const noteId = key.slice(LEGACY_DRAFT_PREFIX.length);
        const backup = parseLegacyDraft(localStorage.getItem(key), noteId);
        if (!backup) continue;
        const current = loadEditDraft(noteId);
        if (
          (!backup.content.trim() && !backup.title.trim()) ||
          (current?.content === backup.content &&
            current.title === backup.title)
        )
          localStorage.removeItem(key);
      } else if (key.startsWith(EDIT_DRAFT_PREFIX)) {
        const noteId = key.slice(EDIT_DRAFT_PREFIX.length);
        const older = parseLegacyDraft(localStorage.getItem(key), noteId);
        if (older && !older.content.trim() && !older.title.trim())
          localStorage.removeItem(key);
      }
    }
    prunedRedundantDrafts = true;
  } catch {
    // Recovery storage may be unavailable in restricted browser contexts.
  }
}

export function loadLegacyEditDraft(
  noteId: string,
): Pick<EditNoteDraft, "content" | "title"> | undefined {
  try {
    const backup = localStorage.getItem(legacyDraftKey(noteId));
    const legacy = parseLegacyDraft(
      backup ?? localStorage.getItem(editDraftKey(noteId)),
      noteId,
    );
    if (legacy && !legacy.content.trim() && !legacy.title.trim()) {
      localStorage.removeItem(
        backup !== null ? legacyDraftKey(noteId) : editDraftKey(noteId),
      );
      return undefined;
    }
    return legacy;
  } catch {
    return undefined;
  }
}

function parseLegacyDraft(value: string | null, noteId: string) {
  if (!value) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const draft = parsed as Record<string, unknown>;
  if (
    typeof draft.content !== "string" ||
    typeof draft.title !== "string" ||
    (draft.noteId !== undefined && draft.noteId !== noteId) ||
    (typeof draft.baseContent === "string" &&
      (draft.baseTitle === null || typeof draft.baseTitle === "string"))
  )
    return undefined;
  return { content: draft.content, title: draft.title };
}

export function loadEditDraft(noteId: string): EditNoteDraft | undefined {
  try {
    const value = localStorage.getItem(editDraftKey(noteId));
    if (!value) return undefined;
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      const draft = parsed as Record<string, unknown>;
      if (
        typeof draft.content !== "string" ||
        typeof draft.title !== "string" ||
        typeof draft.baseContent !== "string" ||
        (draft.baseTitle !== null && typeof draft.baseTitle !== "string") ||
        draft.noteId !== noteId
      )
        return undefined;
      return {
        content: draft.content,
        title: draft.title,
        baseContent: draft.baseContent,
        baseTitle: draft.baseTitle,
      };
    }
    // Older drafts lack a server baseline and cannot safely be replayed.
    return undefined;
  } catch {
    return undefined;
  }
}

export function saveEditDraft(
  noteId: string,
  content: string,
  title: string,
  baseContent: string,
  baseTitle: string | null,
) {
  try {
    const legacy = loadLegacyEditDraft(noteId);
    if (legacy && !localStorage.getItem(legacyDraftKey(noteId))) {
      const previous = localStorage.getItem(editDraftKey(noteId));
      if (previous) localStorage.setItem(legacyDraftKey(noteId), previous);
    }
    localStorage.setItem(
      editDraftKey(noteId),
      JSON.stringify({ noteId, content, title, baseContent, baseTitle }),
    );
    if (
      legacy &&
      localStorage.getItem(legacyDraftKey(noteId)) &&
      legacy.content === content &&
      legacy.title === title
    ) {
      localStorage.removeItem(legacyDraftKey(noteId));
    }
  } catch {}
}

export function clearEditDraft(
  noteId: string,
  confirmed?: { content: string; title?: string | null },
) {
  try {
    if (loadEditDraft(noteId)) localStorage.removeItem(editDraftKey(noteId));
    if (!confirmed) return;
    const olderCurrent = parseLegacyDraft(
      localStorage.getItem(editDraftKey(noteId)),
      noteId,
    );
    if (olderCurrent && matchesConfirmedNote(olderCurrent, confirmed))
      localStorage.removeItem(editDraftKey(noteId));
    const legacy = parseLegacyDraft(
      localStorage.getItem(legacyDraftKey(noteId)),
      noteId,
    );
    if (legacy && matchesConfirmedNote(legacy, confirmed))
      localStorage.removeItem(legacyDraftKey(noteId));
  } catch {}
}

function matchesConfirmedNote(
  draft: Pick<EditNoteDraft, "content" | "title">,
  confirmed: { content: string; title?: string | null },
) {
  return (
    draft.content === confirmed.content &&
    (draft.title.trim() || null) === (confirmed.title?.trim() || null)
  );
}

export function clearDeletedNoteDrafts(noteId: string) {
  try {
    localStorage.removeItem(editDraftKey(noteId));
    localStorage.removeItem(legacyDraftKey(noteId));
  } catch {}
}

export function isEditDraftStale(
  draft: EditNoteDraft,
  current: { content: string; title?: string | null },
) {
  return (
    draft.baseContent !== current.content ||
    draft.baseTitle !== (current.title ?? null)
  );
}

export function isNoteEditConflict(error: unknown) {
  return error instanceof ApiError && error.code === "conflict";
}

export function getNoteSaveErrorMessage(error: unknown, fallback: string) {
  if (isNoteEditConflict(error))
    return "This note changed elsewhere. Compare versions before saving your edits.";
  return getUserFacingApiErrorMessage(error, fallback);
}
