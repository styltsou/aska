import { useCallback, useEffect, useRef, useState } from "react";

import type { NoteAsset } from "@/types/asset";

export function useImmediateNoteDrawer(
  routeNote: NoteAsset | undefined,
  routeNoteId: string | undefined,
) {
  const routeNoteRef = useRef(routeNote);
  routeNoteRef.current = routeNote;
  const [drawerNote, setDrawerNote] = useState(routeNote);
  const lastResolvedRouteNoteId = useRef(routeNote?.id);

  useEffect(() => {
    if (!routeNoteId) {
      lastResolvedRouteNoteId.current = undefined;
      setDrawerNote(undefined);
      return;
    }

    const resolvedRouteNote = routeNoteRef.current;
    if (resolvedRouteNote?.id !== routeNoteId) {
      if (lastResolvedRouteNoteId.current !== routeNoteId) {
        setDrawerNote(undefined);
      }
      return;
    }

    lastResolvedRouteNoteId.current = routeNoteId;
    setDrawerNote((current) =>
      current?.id === resolvedRouteNote.id &&
      current.content === resolvedRouteNote.content &&
      current.color === resolvedRouteNote.color &&
      current.isFavorite === resolvedRouteNote.isFavorite &&
      current.wordCount === resolvedRouteNote.wordCount &&
      current.readingTimeMinutes === resolvedRouteNote.readingTimeMinutes
        ? current
        : resolvedRouteNote,
    );
  }, [
    routeNote?.color,
    routeNote?.content,
    routeNote?.id,
    routeNote?.isFavorite,
    routeNote?.readingTimeMinutes,
    routeNote?.wordCount,
    routeNoteId,
  ]);

  const openDrawer = useCallback((note: NoteAsset) => {
    setDrawerNote(note);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerNote(undefined);
  }, []);

  return { drawerNote, openDrawer, closeDrawer };
}
