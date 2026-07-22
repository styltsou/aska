import { useCallback, useEffect, useRef, useState } from "react";

import type { NoteAsset } from "@/types/asset";

export function useImmediateNoteDrawer(
  routeNote: NoteAsset | undefined,
  routeNoteId: string | undefined,
) {
  const [drawerNote, setDrawerNote] = useState(routeNote);
  const lastResolvedRouteNoteId = useRef(routeNote?.id);

  useEffect(() => {
    if (!routeNoteId) {
      lastResolvedRouteNoteId.current = undefined;
      setDrawerNote(undefined);
      return;
    }

    if (routeNote?.id !== routeNoteId) {
      if (lastResolvedRouteNoteId.current !== routeNoteId) {
        setDrawerNote(undefined);
      }
      return;
    }

    if (lastResolvedRouteNoteId.current !== routeNoteId) {
      lastResolvedRouteNoteId.current = routeNoteId;
      setDrawerNote(routeNote);
    }
  }, [routeNote, routeNote?.id, routeNoteId]);

  const openDrawer = useCallback((note: NoteAsset) => {
    setDrawerNote(note);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerNote(undefined);
  }, []);

  return { drawerNote, openDrawer, closeDrawer };
}
