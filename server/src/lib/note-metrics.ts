const WORDS_PER_MINUTE = 200;
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/gu;

export type NoteMetrics = {
  wordCount: number;
  readingTimeMinutes: number;
};

export function calculateNoteMetrics(markdown: string): NoteMetrics {
  const plainText = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~>#|[\](){}\\]/g, " ")
    .replace(/-{3,}|_{3,}|\*{3,}/g, " ")
    .replace(/<[^>]+>/g, " ");

  const wordCount = plainText.match(WORD_PATTERN)?.length ?? 0;

  return {
    wordCount,
    readingTimeMinutes:
      wordCount === 0
        ? 0
        : Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)),
  };
}
