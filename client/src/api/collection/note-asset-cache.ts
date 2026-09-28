import type { PeekableAssetResponse, UpdatedNote } from "./types";

export function applySavedNoteToWorkspaceAsset(
  current: PeekableAssetResponse | undefined,
  saved: UpdatedNote,
): PeekableAssetResponse | undefined {
  if (current?.asset.type !== "note" || current.asset.id !== saved.id)
    return current;
  return { ...current, asset: { ...current.asset, ...saved } };
}
