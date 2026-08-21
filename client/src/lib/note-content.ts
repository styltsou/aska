export function getSaveableNoteContent(content: string): string | undefined {
  return content.trim().length > 0 ? content : undefined;
}
