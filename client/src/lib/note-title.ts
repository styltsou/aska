export type ExtractedNoteTitle = {
  title: string | null;
  content: string;
};

const ATX_H1 = /^ {0,3}#(?!#)(?:[ \t]+(.*)|[ \t]*)$/;
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Separates the first real Markdown H1 from pasted note content. */
export function extractPastedNoteTitle(markdown: string): ExtractedNoteTitle {
  const lines = markdown.split(/\r?\n/);
  let fence: "`" | "~" | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      const marker = fenceMatch[1]![0] as "`" | "~";
      fence = fence === marker ? undefined : (fence ?? marker);
      continue;
    }
    if (fence) continue;

    const atx = line.match(ATX_H1);
    if (atx) {
      const title = (atx[1] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
      if (title) return stripHeading(lines, index, index + 1, title);
    }

    const underline = lines[index + 1];
    if (line.trim() && underline && SETEXT_H1.test(underline)) {
      return stripHeading(lines, index, index + 2, line.trim());
    }
  }

  return { title: null, content: markdown };
}

function stripHeading(
  lines: string[],
  start: number,
  end: number,
  title: string,
): ExtractedNoteTitle {
  const before = lines.slice(0, start);
  const after = lines.slice(end);
  if (before.at(-1) === "" && after[0] === "") after.shift();
  const content = [...before, ...after].join("\n").replace(/^\n+/, "");
  return { title, content };
}
