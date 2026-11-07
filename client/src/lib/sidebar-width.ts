export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 224;
export const SIDEBAR_MAX_WIDTH = 384;

export function getSidebarMaxWidth(viewportWidth: number): number {
  return Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, Math.floor(viewportWidth * 0.4)),
  );
}

export function clampSidebarWidth(
  width: number,
  viewportWidth = Infinity,
): number {
  return Math.min(
    getSidebarMaxWidth(viewportWidth),
    Math.max(
      SIDEBAR_MIN_WIDTH,
      Number.isFinite(width) ? width : SIDEBAR_DEFAULT_WIDTH,
    ),
  );
}

export function readSidebarWidth(storageKey?: string): number {
  if (!storageKey || typeof window === "undefined")
    return SIDEBAR_DEFAULT_WIDTH;
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored === null || stored.trim() === ""
      ? SIDEBAR_DEFAULT_WIDTH
      : clampSidebarWidth(Number(stored));
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

export function saveSidebarWidth(
  storageKey: string | undefined,
  width: number,
) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, String(clampSidebarWidth(width)));
  } catch {
    // Resizing still works when browser storage is unavailable.
  }
}
