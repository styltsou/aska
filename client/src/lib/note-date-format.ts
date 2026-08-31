const NOTE_METADATA_DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatNoteHeaderEditTime(
  iso: string,
  now = Date.now(),
): string {
  const timestamp = new Date(iso).getTime();
  const elapsedMs = now - timestamp;
  if (!Number.isFinite(elapsedMs)) return "";
  if (elapsedMs < 60_000) return "just now";

  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatNoteMetadataDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return NOTE_METADATA_DATE_TIME_FORMAT.format(date);
}
