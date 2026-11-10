type DropPreview = {
  kind: "image" | "video";
  width: number;
  height: number;
};

const HANDOFF_RETENTION_MS = 10 * 60_000;
const pendingPreviews = new Map<string, DropPreview>();
const expiryTimers = new Map<string, number>();

export function rememberCanvasDropPreview(id: string, preview: DropPreview) {
  pendingPreviews.set(id, preview);
  window.clearTimeout(expiryTimers.get(id));
  expiryTimers.set(
    id,
    window.setTimeout(() => {
      pendingPreviews.delete(id);
      expiryTimers.delete(id);
    }, HANDOFF_RETENTION_MS),
  );
}

export function consumeCanvasDropPreview(id: string | undefined) {
  if (!id) return undefined;
  const preview = pendingPreviews.get(id);
  if (!preview) return undefined;
  pendingPreviews.delete(id);
  window.clearTimeout(expiryTimers.get(id));
  expiryTimers.delete(id);
  return preview;
}
