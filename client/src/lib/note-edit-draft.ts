import { ApiError, getUserFacingApiErrorMessage } from "@/lib/api";

export type EditNoteDraft = {
  content: string;
  title: string;
  baseContent: string;
  baseTitle: string | null;
};

const editDraftKey = (noteId: string) => `aska.edit-note-draft:${noteId}`;
const legacyDraftKey = (noteId: string) =>
  `aska.edit-note-draft-legacy:${noteId}`;

export function loadLegacyEditDraft(
  noteId: string,
): Pick<EditNoteDraft, "content" | "title"> | undefined {
  try {
    const value =
      localStorage.getItem(legacyDraftKey(noteId)) ??
      localStorage.getItem(editDraftKey(noteId));
    if (!value) return undefined;
    const parsed: unknown = JSON.parse(value);
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
  } catch {
    return undefined;
  }
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
  } catch {}
}

export function clearEditDraft(noteId: string) {
  try {
    if (loadEditDraft(noteId)) localStorage.removeItem(editDraftKey(noteId));
  } catch {}
}

export function getNoteSaveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === "conflict")
    return "This note changed elsewhere. Your draft remains in the editor; copy it before reloading.";
  return getUserFacingApiErrorMessage(error, fallback);
}
