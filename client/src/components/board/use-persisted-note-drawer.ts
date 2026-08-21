import { useCallback, useEffect, useState } from "react";

import type { NoteAsset } from "@/types/asset";

type DrawerState = {
  storageKey: string;
  note: NoteAsset | undefined;
};

export function persistNoteDrawer(storageKey: string, note: NoteAsset) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(note));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

/** Keeps a board's open note for the lifetime of the current browser tab. */
export function usePersistedNoteDrawer(storageKey: string) {
  const [state, setState] = useState<DrawerState>(() => ({
    storageKey,
    note: readStoredNote(storageKey),
  }));
  const drawerNote = state.storageKey === storageKey ? state.note : undefined;

  useEffect(() => {
    if (state.storageKey === storageKey) return;
    setState({ storageKey, note: readStoredNote(storageKey) });
  }, [state.storageKey, storageKey]);

  useEffect(() => {
    if (state.storageKey !== storageKey) return;
    try {
      if (state.note) {
        persistNoteDrawer(storageKey, state.note);
      } else {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, [state, storageKey]);

  const openDrawer = useCallback(
    (note: NoteAsset) => setState({ storageKey, note }),
    [storageKey],
  );
  const closeDrawer = useCallback(
    () => setState({ storageKey, note: undefined }),
    [storageKey],
  );

  return { drawerNote, openDrawer, closeDrawer, updateDrawerNote: openDrawer };
}

function readStoredNote(storageKey: string): NoteAsset | undefined {
  try {
    const rawNote = sessionStorage.getItem(storageKey);
    if (!rawNote) return undefined;
    const note: unknown = JSON.parse(rawNote);
    if (
      typeof note === "object" &&
      note !== null &&
      "id" in note &&
      typeof note.id === "string" &&
      "type" in note &&
      note.type === "note" &&
      "content" in note &&
      typeof note.content === "string"
    ) {
      return note as NoteAsset;
    }
    sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore malformed or unavailable session storage.
  }
  return undefined;
}
