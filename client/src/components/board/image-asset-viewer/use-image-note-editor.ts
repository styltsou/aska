import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useUpdateImage } from "@/api/collection";
import type { ImageAsset } from "@/types/asset";

const IMAGE_NOTE_STORAGE_KEY = "aska:image-note:v2:";
const LEGACY_IMAGE_NOTE_STORAGE_KEY = "aska:image-note:";
const IMAGE_NOTE_AUTOSAVE_DELAY_MS = 350;

function imageNoteStorageKey(workspaceSlug: string, assetId: string) {
  return `${IMAGE_NOTE_STORAGE_KEY}${JSON.stringify([workspaceSlug, assetId])}`;
}

function readImageNoteDraft(
  workspaceSlug: string,
  assetId: string,
  hasServerNote: boolean,
): string | undefined {
  try {
    const current = window.localStorage.getItem(
      imageNoteStorageKey(workspaceSlug, assetId),
    );
    if (current !== null) return current;
    if (hasServerNote) return undefined;

    return (
      window.localStorage.getItem(
        `${LEGACY_IMAGE_NOTE_STORAGE_KEY}${assetId}`,
      ) ?? undefined
    );
  } catch {
    return undefined;
  }
}

function saveImageNoteDraft(
  workspaceSlug: string,
  assetId: string,
  note: string,
) {
  try {
    window.localStorage.setItem(
      imageNoteStorageKey(workspaceSlug, assetId),
      note,
    );
  } catch {
    // Recovery is best effort when storage is unavailable.
  }
}

function clearImageNoteDraft(workspaceSlug: string, assetId: string) {
  try {
    window.localStorage.removeItem(imageNoteStorageKey(workspaceSlug, assetId));
    window.localStorage.removeItem(
      `${LEGACY_IMAGE_NOTE_STORAGE_KEY}${assetId}`,
    );
  } catch {
    // Recovery cleanup is best effort when storage is unavailable.
  }
}

export function useImageNoteEditor({
  asset,
  workspaceSlug,
  onSaved,
}: {
  asset?: ImageAsset;
  workspaceSlug: string;
  onSaved?: (asset: ImageAsset) => void;
}) {
  const { mutateAsync: updateImageAsync } = useUpdateImage(workspaceSlug);
  const [note, setNote] = useState("");
  const assetIdRef = useRef<string | undefined>(undefined);
  const draftRef = useRef("");
  const serverNoteRef = useRef<string | null | undefined>(asset?.note);
  const savedRef = useRef(new Map<string, string>());
  const timerRef = useRef<number | undefined>(undefined);
  const requestRef = useRef<Promise<void> | null>(null);
  const queueRef = useRef(new Map<string, string>());
  const onSavedRef = useRef(onSaved);
  const assetRef = useRef(asset);
  onSavedRef.current = onSaved;
  assetRef.current = asset;

  useEffect(() => {
    serverNoteRef.current = asset?.note;
  }, [asset?.id, asset?.note]);

  const persist = useCallback(
    (assetId: string, draft: string) => {
      const savedNote = savedRef.current.get(assetId) ?? null;
      const nextNote = draft.trim() ? draft : null;
      if (nextNote === savedNote) {
        clearImageNoteDraft(workspaceSlug, assetId);
        return;
      }

      if (requestRef.current) {
        queueRef.current.set(assetId, draft);
        return;
      }

      const request = updateImageAsync({ assetId, note: nextNote })
        .then(({ image: updatedImage }) => {
          const updatedNote = updatedImage.note ?? "";
          savedRef.current.set(assetId, updatedNote);

          if (assetIdRef.current === assetId) {
            if (draftRef.current === draft) {
              draftRef.current = updatedNote;
              setNote(updatedNote);
              clearImageNoteDraft(workspaceSlug, assetId);
            } else {
              queueRef.current.set(assetId, draftRef.current);
            }
          } else if (queueRef.current.get(assetId) === draft) {
            queueRef.current.delete(assetId);
            clearImageNoteDraft(workspaceSlug, assetId);
          } else {
            clearImageNoteDraft(workspaceSlug, assetId);
          }

          const currentAsset = assetRef.current;
          if (currentAsset?.id === assetId) {
            onSavedRef.current?.({
              ...currentAsset,
              ...updatedImage,
              note: updatedImage.note,
            });
          }
        })
        .catch((error: unknown) => {
          saveImageNoteDraft(workspaceSlug, assetId, draft);
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not save image note.",
          );
        })
        .finally(() => {
          requestRef.current = null;
          const queued = queueRef.current.get(assetId);
          if (queued !== undefined) {
            queueRef.current.delete(assetId);
            persist(assetId, queued);
            return;
          }

          const nextQueued = queueRef.current.entries().next().value;
          if (nextQueued) {
            const [nextAssetId, nextDraft] = nextQueued;
            queueRef.current.delete(nextAssetId);
            persist(nextAssetId, nextDraft);
          }
        });

      requestRef.current = request;
    },
    [updateImageAsync, workspaceSlug],
  );

  const flush = useCallback(async () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    const assetId = assetIdRef.current;
    if (assetId) persist(assetId, draftRef.current);

    let pending = requestRef.current;
    while (pending) {
      await pending;
      if (requestRef.current === pending) break;
      pending = requestRef.current;
    }
    return draftRef.current;
  }, [persist]);

  useEffect(() => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }

    const assetId = asset?.id;
    if (!assetId) {
      assetIdRef.current = undefined;
      draftRef.current = "";
      setNote("");
      return;
    }

    const serverNote = serverNoteRef.current ?? "";
    const recoveredDraft = readImageNoteDraft(
      workspaceSlug,
      assetId,
      Boolean(serverNote),
    );
    const nextDraft = recoveredDraft ?? serverNote;
    assetIdRef.current = assetId;
    savedRef.current.set(assetId, serverNote);
    draftRef.current = nextDraft;
    setNote(nextDraft);

    if (recoveredDraft !== undefined && recoveredDraft !== serverNote) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        persist(assetId, recoveredDraft);
      }, IMAGE_NOTE_AUTOSAVE_DELAY_MS);
    }
  }, [asset?.id, persist, workspaceSlug]);

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const onChange = useCallback(
    (value: string) => {
      const assetId = assetIdRef.current;
      if (!assetId) return;

      draftRef.current = value;
      setNote(value);
      saveImageNoteDraft(workspaceSlug, assetId, value);

      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = undefined;
        persist(assetId, draftRef.current);
      }, IMAGE_NOTE_AUTOSAVE_DELAY_MS);
    },
    [persist, workspaceSlug],
  );

  return { note, onChange, flush };
}
