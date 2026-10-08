const SUPPRESSION_TTL_MS = 30_000;
const suppressedEntrances = new Map<string, number>();

/** Suppresses one card entrance while a direct-manipulation preview hands off. */
export function suppressNextCanvasCardEntrance(identity: string): void {
  const now = Date.now();
  for (const [candidate, expiresAt] of suppressedEntrances) {
    if (expiresAt <= now) suppressedEntrances.delete(candidate);
  }
  suppressedEntrances.set(identity, now + SUPPRESSION_TTL_MS);
}

/** Consumes a pending one-shot entrance suppression for a newly mounted card. */
export function consumeCanvasCardEntranceSuppression(
  identity: string,
): boolean {
  const expiresAt = suppressedEntrances.get(identity);
  suppressedEntrances.delete(identity);
  return expiresAt !== undefined && expiresAt > Date.now();
}

export function resolveCanvasCardPresence({
  currentNodeId,
  nextNodeId,
  currentPresence,
  isNew,
  entranceSuppressed,
}: {
  currentNodeId?: string;
  nextNodeId: string;
  currentPresence?: "entering" | "exiting";
  isNew: boolean;
  entranceSuppressed: boolean;
}): "entering" | "exiting" | undefined {
  if (
    currentNodeId !== undefined &&
    currentNodeId !== nextNodeId &&
    currentPresence === "entering"
  ) {
    return undefined;
  }

  return (
    currentPresence ??
    (isNew && !entranceSuppressed ? "entering" : undefined)
  );
}
