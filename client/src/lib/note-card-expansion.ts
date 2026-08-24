const STORAGE_KEY_PREFIX = "aska.note-card-expansion:v1:";

const expandedIdsCache = new Map<string, Set<string>>();

export function getExpandedNoteIds(collectionSlug: string): Set<string> {
  const cached = expandedIdsCache.get(collectionSlug);
  if (cached) return new Set(cached);

  const expandedIds = new Set<string>();
  if (typeof window === "undefined") return expandedIds;

  try {
    const raw = window.localStorage.getItem(storageKey(collectionSlug));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      for (const id of parsed) {
        if (typeof id === "string") expandedIds.add(id);
      }
    }
  } catch {
    // Local UI preferences are best effort when storage is unavailable.
  }

  expandedIdsCache.set(collectionSlug, expandedIds);
  return new Set(expandedIds);
}

export function setNoteExpanded(
  collectionSlug: string,
  noteId: string,
  expanded: boolean,
): void {
  const expandedIds =
    expandedIdsCache.get(collectionSlug) ?? getExpandedNoteIds(collectionSlug);

  if (expanded) expandedIds.add(noteId);
  else expandedIds.delete(noteId);

  expandedIdsCache.set(collectionSlug, expandedIds);
  persist(collectionSlug, expandedIds);
}

export function pruneExpandedNoteIds(
  collectionSlug: string,
  validNoteIds: Iterable<string>,
): void {
  const validIds = new Set(validNoteIds);
  const expandedIds =
    expandedIdsCache.get(collectionSlug) ?? getExpandedNoteIds(collectionSlug);
  let changed = false;

  for (const noteId of expandedIds) {
    if (!validIds.has(noteId)) {
      expandedIds.delete(noteId);
      changed = true;
    }
  }

  if (changed) persist(collectionSlug, expandedIds);
}

function storageKey(collectionSlug: string): string {
  return `${STORAGE_KEY_PREFIX}${collectionSlug}`;
}

function persist(collectionSlug: string, expandedIds: Set<string>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      storageKey(collectionSlug),
      JSON.stringify([...expandedIds]),
    );
  } catch {
    // Local UI preferences are best effort when storage is unavailable.
  }
}
