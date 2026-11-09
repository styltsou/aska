/**
 * Context for the note agent: the overview the model always gets (the whole
 * text when it's short, otherwise an outline and an excerpt), and the read and
 * search helpers its tools use to look closer. Everything works on plain
 * Markdown lines, numbered from 1.
 */

/** Documents up to this size are included whole; a lookup would cost more. */
export const FULL_TEXT_LIMIT = 6_000;
/** The excerpt around the cursor in a long note. */
const EXCERPT_BEFORE = 4_000;
const EXCERPT_AFTER = 1_500;
/** Caps on what a single tool call returns. */
export const READ_LIMIT = 8_000;
const SEARCH_MATCH_LIMIT = 20;
const LINE_PREVIEW_LIMIT = 300;
/** First lines shown on a reference card. */
const CARD_PREVIEW = 600;

export type ContextDocument = { id: string; title: string; text: string };

type Heading = { line: number; level: number; title: string };

function headings(lines: string[]): Heading[] {
  const found: Heading[] = [];
  let inFence = false;
  lines.forEach((text, index) => {
    if (/^\s*(```|~~~)/.test(text)) inFence = !inFence;
    const match = !inFence && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(text);
    if (match) {
      found.push({
        line: index + 1,
        level: match[1]!.length,
        title: match[2]!,
      });
    }
  });
  return found;
}

const numbered = (lines: string[], firstLine: number) =>
  lines.map((text, index) => `${firstLine + index}| ${text}`).join("\n");

function capped(text: string, limit: number) {
  return text.length <= limit
    ? text
    : `${text.slice(0, limit)}\n… (cut at ${limit} characters; read a narrower range for more)`;
}

/** Headings with line numbers and section sizes, one per line. */
export function outline(text: string) {
  const lines = text.split("\n");
  const found = headings(lines);
  if (!found.length) return "(no headings)";
  return found
    .map((heading, index) => {
      const end = (found[index + 1]?.line ?? lines.length + 1) - 1;
      const size = lines.slice(heading.line - 1, end).join("\n").length;
      return `${"  ".repeat(heading.level - 1)}- ${heading.title} (lines ${heading.line}–${end}, ~${size} chars)`;
    })
    .join("\n");
}

/** The overview of a note: whole when short, otherwise outline and excerpt. */
export function noteOverview(note: string, marker: string) {
  if (note.length <= FULL_TEXT_LIMIT) {
    return { complete: true, text: `<note>\n${note}\n</note>` };
  }
  const lines = note.split("\n");
  const cursor = Math.max(0, note.indexOf(marker));
  const start = Math.max(0, cursor - EXCERPT_BEFORE);
  const end = Math.min(note.length, cursor + marker.length + EXCERPT_AFTER);
  const firstLine = note.slice(0, start).split("\n").length;
  const excerptLines = note.slice(start, end).split("\n");
  return {
    complete: false,
    text:
      `The note is long (${lines.length} lines, ${note.length} characters); you see its outline and the part around the cursor. Use the note tools to read or search the rest.\n\n` +
      `<note-outline>\n${outline(note)}\n</note-outline>\n\n` +
      `<note-excerpt lines="${firstLine}–${firstLine + excerptLines.length - 1}">\n${numbered(excerptLines, firstLine)}\n</note-excerpt>`,
  };
}

/** A mentioned document: whole when short, otherwise a card. */
export function referenceOverview(document: ContextDocument) {
  const attributes = `id="${document.id}" title="${document.title.replaceAll('"', "'")}"`;
  if (document.text.length <= FULL_TEXT_LIMIT) {
    return {
      complete: true,
      text: `<referenced-note ${attributes}>\n${document.text}\n</referenced-note>`,
    };
  }
  const lines = document.text.split("\n");
  return {
    complete: false,
    text:
      `<reference-card ${attributes} lines="${lines.length}" chars="${document.text.length}">\n` +
      `Outline:\n${outline(document.text)}\n\n` +
      `Beginning:\n${capped(document.text.slice(0, CARD_PREVIEW), CARD_PREVIEW)}\n` +
      `</reference-card>`,
  };
}

/**
 * Reads part of a document: a section by heading (matched case-insensitively,
 * running to the next heading of the same or higher level), or a line range.
 */
export function readSection(
  text: string,
  {
    heading,
    fromLine,
    toLine,
  }: {
    heading?: string | undefined;
    fromLine?: number | undefined;
    toLine?: number | undefined;
  },
) {
  const lines = text.split("\n");
  let start = 1;
  let end = lines.length;
  if (heading) {
    const found = headings(lines);
    const wanted = heading
      .trim()
      .toLowerCase()
      .replace(/^#+\s*/, "");
    const index = found.findIndex((item) =>
      item.title.toLowerCase().includes(wanted),
    );
    if (index < 0) {
      return `No heading matches "${heading}". Headings:\n${outline(text)}`;
    }
    const match = found[index]!;
    const next = found
      .slice(index + 1)
      .find((item) => item.level <= match.level);
    start = match.line;
    end = (next?.line ?? lines.length + 1) - 1;
  } else if (fromLine || toLine) {
    start = Math.max(1, fromLine ?? 1);
    end = Math.min(lines.length, toLine ?? start + 199);
  }
  if (start > end) return "That range is empty.";
  return capped(numbered(lines.slice(start - 1, end), start), READ_LIMIT);
}

/** Finds lines matching `pattern` (a regex, or plain text if it isn't one). */
export function searchText(text: string, pattern: string) {
  let matcher: RegExp;
  try {
    matcher = new RegExp(pattern, "i");
  } catch {
    matcher = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  const lines = text.split("\n");
  const matches: string[] = [];
  let total = 0;
  lines.forEach((line, index) => {
    if (!matcher.test(line)) return;
    total += 1;
    if (matches.length >= SEARCH_MATCH_LIMIT) return;
    const preview =
      line.length > LINE_PREVIEW_LIMIT
        ? `${line.slice(0, LINE_PREVIEW_LIMIT)}…`
        : line;
    matches.push(`${index + 1}| ${preview}`);
  });
  if (!total) return `No lines match "${pattern}".`;
  const more =
    total > matches.length
      ? `\n… ${total - matches.length} more matches; use a narrower pattern.`
      : "";
  return `${total} matching line${total === 1 ? "" : "s"}:\n${matches.join("\n")}${more}`;
}
