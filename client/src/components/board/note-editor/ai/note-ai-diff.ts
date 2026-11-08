import { diffArrays } from "diff";
import type { Fragment, Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Word-level comparison between a previous AI draft and the draft now in the
 * note, expressed as positions in the note so it can be drawn as decorations
 * without touching the document: added text is highlighted in place, removed
 * text is shown (struck through) where it used to be. Keeping the draft keeps
 * only the new text.
 *
 * Text is compared across block boundaries, so text moved between paragraphs
 * or into a list reads as an edit, not as a whole block removed and re-added.
 * Formatting-only changes (bold, a heading level) aren't shown.
 */

export type NoteAiDraftDiff = {
  /** Ranges of new text. */
  added: Array<{ from: number; to: number }>;
  /** Whole new non-text blocks (images, dividers). */
  addedNodes: Array<{ from: number; to: number }>;
  /**
   * Removed text, shown just before `pos`; `block` when it was whole blocks,
   * shown on its own line.
   */
  removed: Array<{ pos: number; text: string; block?: boolean }>;
};

type Token = {
  text: string;
  from: number;
  to: number;
  /** Separates blocks; never highlighted on its own. */
  boundary?: boolean;
  /** A non-text block such as an image. */
  atom?: boolean;
};

const WORDS = /\s+|[^\s]+/g;

function tokenize(content: Fragment, start: number): Token[] {
  const tokens: Token[] = [];
  content.descendants((node, offset) => {
    const pos = start + offset;
    if (node.isTextblock) {
      tokenizeTextblock(node, pos + 1, tokens);
      const end = pos + node.nodeSize - 1;
      tokens.push({ text: "\n", from: end, to: end, boundary: true });
      return false;
    }
    if (node.isAtom && node.isBlock) {
      tokens.push({
        text: `￼${node.type.name}:${JSON.stringify(node.attrs)}`,
        from: pos,
        to: pos + node.nodeSize,
        atom: true,
      });
      return false;
    }
    return true;
  });
  return tokens;
}

function tokenizeTextblock(
  block: ProseMirrorNode,
  start: number,
  tokens: Token[],
) {
  block.forEach((child, offset) => {
    const pos = start + offset;
    if (!child.isText) {
      tokens.push({
        text: `￼${child.type.name}`,
        from: pos,
        to: pos + child.nodeSize,
      });
      return;
    }
    for (const match of (child.text ?? "").matchAll(WORDS)) {
      const from = pos + (match.index ?? 0);
      tokens.push({ text: match[0], from, to: from + match[0].length });
    }
  });
}

const isBlank = (token: Token) => token.boundary || !token.text.trim();

/**
 * Compares `previous` (the earlier draft) with the content of `doc` between
 * `from` and `to` (the draft now in the note).
 */
export function diffNoteAiDraft(
  previous: Fragment,
  doc: ProseMirrorNode,
  from: number,
  to: number,
): NoteAiDraftDiff {
  const before = tokenize(previous, 0);
  const after = tokenize(doc.slice(from, to).content, from);
  const diff: NoteAiDraftDiff = { added: [], addedNodes: [], removed: [] };

  // A hunk is a run of changes plus the blank space between them; its removed
  // text is shown once, where the hunk starts in the new draft.
  let removed: string[] = [];
  let hunkIndex: number | null = null;
  let hunkAdded = false;
  let hunkRemovedBlock = false;
  const flushHunk = () => {
    const text = removed
      .map((value) => (value === "\n" ? " " : value))
      .join("")
      .replace(/￼\S*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text && hunkIndex !== null) {
      // Whole blocks removed with nothing in their place read best on their
      // own line, after the block before them.
      const block = hunkRemovedBlock && !hunkAdded;
      const previousEnd = block ? blockEndBefore(hunkIndex) : null;
      diff.removed.push({
        pos: previousEnd ?? positionAt(hunkIndex),
        text,
        ...(block ? { block: true } : {}),
      });
    }
    removed = [];
    hunkIndex = null;
    hunkAdded = false;
    hunkRemovedBlock = false;
  };
  const positionAt = (index: number) =>
    after[index]?.from ?? after.at(-1)?.to ?? from;
  const blockEndBefore = (index: number) => {
    for (let i = index - 1; i >= 0; i--) {
      if (after[i]!.boundary) return after[i]!.from;
    }
    return null;
  };

  let index = 0;
  for (const change of diffArrays(
    before.map((token) => token.text),
    after.map((token) => token.text),
  )) {
    const count = change.count ?? change.value.length;
    if (change.removed) {
      hunkIndex ??= index;
      if (change.value.includes("\n")) hunkRemovedBlock = true;
      removed.push(...change.value);
      continue;
    }
    if (!change.added) {
      const blank = after.slice(index, index + count).every(isBlank);
      if (hunkIndex !== null && blank) {
        removed.push(...change.value);
      } else {
        flushHunk();
      }
      index += count;
      continue;
    }
    hunkIndex ??= index;
    hunkAdded = true;
    for (const token of after.slice(index, index + count)) {
      if (token.atom) {
        diff.addedNodes.push({ from: token.from, to: token.to });
      } else if (!isBlank(token)) {
        const last = diff.added.at(-1);
        // Join words separated only by spaces into one highlight.
        if (
          last &&
          last.to <= token.from &&
          onlySpacesBetween(doc, last.to, token.from)
        ) {
          last.to = token.to;
        } else {
          diff.added.push({ from: token.from, to: token.to });
        }
      }
    }
    index += count;
  }
  flushHunk();
  return diff;
}

function onlySpacesBetween(doc: ProseMirrorNode, from: number, to: number) {
  if (from === to) return true;
  const $from = doc.resolve(from);
  if (!$from.sameParent(doc.resolve(to))) return false;
  return !doc.textBetween(from, to).trim();
}
