import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import type { Selection } from "@tiptap/pm/state";

import { isListContainer } from "./note-list-nodes";

export type BlockStyleValue =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "bullet-list"
  | "ordered-list"
  | "task-list";

export const BLOCK_STYLE_LABELS: Record<BlockStyleValue, string> = {
  paragraph: "Text",
  "heading-1": "Heading 1",
  "heading-2": "Heading 2",
  "heading-3": "Heading 3",
  "heading-4": "Heading 4",
  "bullet-list": "Bullet list",
  "ordered-list": "Numbered list",
  "task-list": "To-do list",
};

const LIST_STYLES_BY_NAME: Record<string, BlockStyleValue> = {
  taskList: "task-list",
  orderedList: "ordered-list",
  bulletList: "bullet-list",
};

const HEADING_STYLES_BY_LEVEL: Record<number, BlockStyleValue> = {
  1: "heading-1",
  2: "heading-2",
  3: "heading-3",
  4: "heading-4",
};

/**
 * Lists this editor does not know by name still resolve to a list style, so
 * third-party or custom list extensions do not fall back to "Text".
 */
function deriveListStyle(list: ProseMirrorNode): BlockStyleValue {
  const names =
    `${list.type.name} ${list.firstChild?.type.name ?? ""}`.toLowerCase();
  if (/task|check|todo/.test(names)) {
    return "task-list";
  }
  if (/ordered|number/.test(names)) {
    return "ordered-list";
  }
  return "bullet-list";
}

function textblockStyle(node: ProseMirrorNode): BlockStyleValue | null {
  if (node.type.name === "heading") {
    return HEADING_STYLES_BY_LEVEL[Number(node.attrs.level)] ?? null;
  }
  return null;
}

/**
 * Resolves the block style for a resolved position by walking the ancestor
 * chain, so it is stable for any block type instead of relying on
 * `isActive()`, which reports `false` for selections that extend past the
 * block. Lists win over the textblock they contain (matching the markers the
 * user sees), and nested lists resolve to the innermost one.
 */
export function resolveBlockStyleAt($pos: ResolvedPos): BlockStyleValue {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (!isListContainer(node)) continue;
    return LIST_STYLES_BY_NAME[node.type.name] ?? deriveListStyle(node);
  }
  return textblockStyle($pos.parent) ?? "paragraph";
}

/**
 * Uses the start of the selection so a selection that bleeds into the following
 * block still reports the block the user started from.
 */
export function resolveBlockStyle(selection: Selection): BlockStyleValue {
  return resolveBlockStyleAt(selection.$from);
}

export function blockStyleLabel(value: BlockStyleValue) {
  return BLOCK_STYLE_LABELS[value];
}
