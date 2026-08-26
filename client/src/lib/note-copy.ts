import { composeFrontMatter, parseFrontMatter } from "./front-matter";

/** Rebuilds note markdown for copying with its canonical front matter. */
export function composeCopiedNoteMarkdown(
  storedContent: string,
  currentBody: string,
): string {
  return composeFrontMatter(parseFrontMatter(storedContent), currentBody);
}
