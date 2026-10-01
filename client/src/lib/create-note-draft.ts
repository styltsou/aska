const STORAGE_KEY_PREFIX = "aska.create-note-draft:";
const MAX_DRAFT_AGE_MS = 30 * 60 * 1_000;

export type CreateNoteDraft = {
  content: string;
  title?: string;
  open: boolean;
  updatedAt: number;
};

export function getCreateNoteDraftId(
  workspaceSlug: string,
  collectionPath: string,
  target: "collection" | "inbox",
): string | null {
  if (typeof window === "undefined") return null;
  pruneExpiredCreateNoteDrafts();

  return `${STORAGE_KEY_PREFIX}${JSON.stringify([
    workspaceSlug,
    target,
    target === "inbox" ? "" : collectionPath,
  ])}`;
}

function pruneExpiredCreateNoteDrafts() {
  try {
    const storage = window.sessionStorage;
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;
      const value = storage.getItem(key);
      let draft: unknown;
      try {
        draft = value ? JSON.parse(value) : null;
      } catch {
        draft = null;
      }
      if (!isValidDraft(draft) || isExpired(draft.updatedAt))
        storage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function loadCreateNoteDraft(id: string | null): CreateNoteDraft | null {
  if (!id) return null;

  try {
    const value = window.sessionStorage.getItem(id);
    if (!value) return null;

    const draft: unknown = JSON.parse(value);
    if (!isValidDraft(draft) || isExpired(draft.updatedAt)) {
      window.sessionStorage.removeItem(id);
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

export function saveCreateNoteDraft(
  id: string | null,
  draft: Omit<CreateNoteDraft, "updatedAt">,
): void {
  if (!id) return;

  try {
    window.sessionStorage.setItem(
      id,
      JSON.stringify({
        ...draft,
        updatedAt: Date.now(),
      } satisfies CreateNoteDraft),
    );
  } catch {
    // Draft recovery is best effort when storage is unavailable or full.
  }
}

export function clearCreateNoteDraft(id: string | null): void {
  if (!id) return;

  try {
    window.sessionStorage.removeItem(id);
  } catch {
    // Draft recovery is best effort when storage is unavailable.
  }
}

function isExpired(updatedAt: number): boolean {
  return (
    !Number.isFinite(updatedAt) || Date.now() - updatedAt > MAX_DRAFT_AGE_MS
  );
}

function isValidDraft(value: unknown): value is CreateNoteDraft {
  if (!value || typeof value !== "object") return false;

  const draft = value as Partial<CreateNoteDraft>;
  return (
    typeof draft.content === "string" &&
    (draft.title === undefined || typeof draft.title === "string") &&
    typeof draft.open === "boolean" &&
    typeof draft.updatedAt === "number"
  );
}
