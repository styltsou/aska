import { composeFrontMatter, parseFrontMatter } from "./front-matter";

/** Rebuilds note markdown for copying with its canonical front matter. */
export function composeCopiedNoteMarkdown(
  storedContent: string,
  currentBody: string,
  title?: string | null,
): string {
  const frontMatter = parseFrontMatter(storedContent);
  const heading = title?.trim().replace(/\s*\r?\n\s*/g, " ");
  if (!heading) return composeFrontMatter(frontMatter, currentBody);

  const separator =
    frontMatter.raw && !frontMatter.raw.endsWith("\n") ? "\n" : "";
  return `${frontMatter.raw}${separator}# ${heading}${currentBody ? `\n\n${currentBody}` : ""}`;
}
