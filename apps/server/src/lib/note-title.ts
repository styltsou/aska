/** Converts an empty title field into the nullable persisted representation. */
export function normalizeNoteTitle(
  title: string | null | undefined,
): string | null {
  const normalized = title?.trim();
  return normalized || null;
}
