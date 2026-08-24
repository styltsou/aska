import { parseFrontMatter } from "@/lib/front-matter";

export const MAX_NOTE_CONTENT_LENGTH = 100_000;

export const NOTE_CONTENT_LIMIT_MESSAGE =
  "Notes can contain up to 100,000 characters.";

export function isNoteContentTooLong(content: string): boolean {
  return content.length > MAX_NOTE_CONTENT_LENGTH;
}

export function getSaveableNoteContent(content: string): string | undefined {
  return parseFrontMatter(content).body.trim().length > 0 ? content : undefined;
}
