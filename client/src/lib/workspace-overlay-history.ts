import { parseWorkspaceAssetPath } from "./workspace-asset-url";

export type OverlayTrail = {
  boardPathname: string;
  boardDistance?: number;
  directDistance?: number;
  previousMainDistance?: number;
};

export function readOverlayTrail(value: unknown): OverlayTrail | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as { overlayTrail?: OverlayTrail }).overlayTrail;
  if (!candidate || typeof candidate.boardPathname !== "string")
    return undefined;
  if (
    candidate.directDistance !== undefined &&
    (!Number.isSafeInteger(candidate.directDistance) ||
      candidate.directDistance < 1)
  )
    return undefined;
  if (
    candidate.boardDistance !== undefined &&
    (!Number.isSafeInteger(candidate.boardDistance) ||
      candidate.boardDistance < 1)
  )
    return undefined;
  if (
    candidate.previousMainDistance !== undefined &&
    (!Number.isSafeInteger(candidate.previousMainDistance) ||
      candidate.previousMainDistance < 1)
  )
    return undefined;
  return candidate;
}

/** Only shortcut offsets live in history state; the visible state lives in the URL. */
export function nextOverlayTrail(
  previousPathname: string,
  nextPathname: string,
  previousTrail: OverlayTrail | undefined,
  replace: boolean,
): OverlayTrail | undefined {
  const previous = parseWorkspaceAssetPath(previousPathname);
  const next = parseWorkspaceAssetPath(nextPathname);
  if (!next.assetId) return undefined;
  if (previous.boardPathname !== next.boardPathname) {
    return { boardPathname: next.boardPathname };
  }

  const trail =
    previousTrail?.boardPathname === next.boardPathname
      ? previousTrail
      : undefined;
  if (replace) return trail;
  return {
    boardPathname: next.boardPathname,
    boardDistance: previous.assetId
      ? trail?.boardDistance === undefined
        ? undefined
        : trail.boardDistance + 1
      : 1,
    directDistance:
      previous.assetId && trail?.boardDistance === undefined
        ? (trail?.directDistance ?? 0) + 1
        : undefined,
    previousMainDistance:
      previous.assetId && previous.assetId !== next.assetId
        ? 1
        : trail?.previousMainDistance === undefined
          ? undefined
          : trail.previousMainDistance + 1,
  };
}
