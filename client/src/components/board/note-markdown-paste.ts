/** Detect Markdown syntax that is unlikely to be ordinary prose. */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^(?: {0,3})(?:#{1,6}\s+\S|```|~~~|>\s+\S|[-*+]\s+(?:\[[ xX]\]\s+)?\S|\d+[.)]\s+\S|(?:---+|\*\*\*+|___+)\s*$)/m.test(
      text,
    ) ||
    /^\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m.test(text) ||
    /(?:\*\*|__|~~)[^\n]+?(?:\*\*|__|~~)|(?<!\*)\*[^\s*][^\n*]*\*(?!\*)|`[^`\n]+`|!?\[[^\]\n]+\]\([^\s)]+(?:\s+"[^"]*")?\)/.test(
      text,
    )
  );
}

export function getMarkdownPaste(
  clipboard: Pick<DataTransfer, "getData">,
): string | null {
  const markdown = clipboard.getData("text/markdown");
  if (markdown.trim()) return markdown;

  const text = clipboard.getData("text/plain");
  if (!text || !looksLikeMarkdown(text)) return null;

  const html = clipboard.getData("text/html");
  if (html) {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    if (
      parsed.querySelector(
        "strong, b, em, i, u, s, del, a, ul, ol, li, blockquote, h1, h2, h3, h4, h5, h6, table, img",
      )
    )
      return null;
  }
  return text;
}
import { Extension, type JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";

// The note schema has no image node. Keep image Markdown instead of silently
// dropping its URL when the Markdown parser encounters an image token.
export const PreserveMarkdownImages = Extension.create({
  name: "preserveMarkdownImages",
  markdownTokenName: "image",
  parseMarkdown: (token) => ({ type: "text", text: token.raw || "" }),
});

// Tiptap unwraps image-only paragraphs as block images. Our image fallback is
// text, so wrap it back in a paragraph where the schema requires blocks.
export function normalizeMarkdownBlocks(
  node: JSONContent,
  schema: Schema,
): JSONContent {
  if (!node.content || !node.type) return node;
  const children = node.content.map((child) =>
    normalizeMarkdownBlocks(child, schema),
  );
  const type = schema.nodes[node.type];
  if (!type || type.contentMatch.matchType(schema.nodes.text)) {
    return { ...node, content: children };
  }
  const content: JSONContent[] = [];
  let fallbackParagraph: JSONContent | undefined;
  for (const child of children) {
    if (child.type && schema.nodes[child.type]?.isInline) {
      if (!fallbackParagraph) {
        fallbackParagraph = { type: "paragraph", content: [] };
        content.push(fallbackParagraph);
      }
      fallbackParagraph.content?.push(child);
    } else {
      fallbackParagraph = undefined;
      content.push(child);
    }
  }
  return { ...node, content };
}
