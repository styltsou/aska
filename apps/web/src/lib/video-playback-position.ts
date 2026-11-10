let pendingPosition:
  | {
      assetId: string;
      seconds: number;
    }
  | undefined;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

function clearPendingPosition() {
  if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  expiryTimer = undefined;
  pendingPosition = undefined;
}

export function recordVideoPlaybackPosition(assetId: string, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  clearPendingPosition();
  pendingPosition = { assetId, seconds };
  expiryTimer = setTimeout(clearPendingPosition, 1_000);
}

export function consumeVideoPlaybackPosition(assetId: string) {
  if (pendingPosition?.assetId !== assetId) return undefined;
  const seconds = pendingPosition.seconds;
  clearPendingPosition();
  return seconds;
}
