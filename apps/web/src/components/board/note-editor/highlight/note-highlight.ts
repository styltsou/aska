import Highlight from "@tiptap/extension-highlight";

import { isNoteHighlightColor } from "@/lib/note-highlights";

export const NoteHighlight = Highlight.extend({
  inclusive: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-highlight-color") ??
          element.getAttribute("data-color"),
        renderHTML: (attributes: { color?: unknown }) =>
          isNoteHighlightColor(attributes.color)
            ? { "data-highlight-color": attributes.color }
            : {},
      },
    };
  },
  renderMarkdown: (node, helpers) => {
    const color = isNoteHighlightColor(node.attrs?.color)
      ? node.attrs.color
      : "amber";
    if (color === "amber") {
      return `==${helpers.renderChildren(node)}==`;
    }
    return `[highlight color="${color}"]${helpers.renderChildren(node)}[/highlight]`;
  },
  parseMarkdown: (token, helpers) => {
    const color = token.attributes?.color;
    return helpers.applyMark(
      "highlight",
      helpers.parseInline(token.tokens || []),
      isNoteHighlightColor(color) ? { color } : { color: "amber" },
    );
  },
  markdownTokenizer: {
    name: "highlight",
    level: "inline",
    start: (source: string) => {
      const shortcodeIndex = source.indexOf("[highlight");
      const legacyIndex = source.indexOf("==");
      if (shortcodeIndex < 0) return legacyIndex;
      if (legacyIndex < 0) return shortcodeIndex;
      return Math.min(shortcodeIndex, legacyIndex);
    },
    tokenize(source, _tokens, lexer) {
      const shortcode =
        /^\[highlight\s+color="(amber|mint|sky|rose|lavender)"\]([^\n]*?)\[\/highlight\]/.exec(
          source,
        );
      if (shortcode) {
        return {
          type: "highlight",
          raw: shortcode[0],
          attributes: { color: shortcode[1] },
          tokens: lexer.inlineTokens(shortcode[2] ?? ""),
        };
      }

      const legacy = /^==(?!\s+==)([^=\n]+)==/.exec(source);
      if (!legacy) return undefined;

      return {
        type: "highlight",
        raw: legacy[0],
        attributes: { color: "amber" },
        tokens: lexer.inlineTokens(legacy[1] ?? ""),
      };
    },
  },
}).configure({
  multicolor: true,
  HTMLAttributes: { class: "note-highlight" },
});
