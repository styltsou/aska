export function encodeGridCursor(timestamp: string, nodeId: number): string {
  return Buffer.from(`${timestamp}|${nodeId}`).toString("base64url");
}

export function decodeGridCursor(
  cursor: string,
): { timestamp: string; nodeId: number } | null {
  const value = Buffer.from(cursor, "base64url").toString("utf8");
  const match = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\|(\d+)$/.exec(
    value,
  );
  if (!match) return null;
  const nodeId = Number(match[2]);
  if (
    !Number.isSafeInteger(nodeId) ||
    nodeId < 1 ||
    !Number.isFinite(Date.parse(match[1]!.replace(" ", "T") + "Z"))
  )
    return null;
  return { timestamp: match[1]!, nodeId };
}
