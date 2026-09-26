import { Extension, isNodeEmpty } from "@tiptap/core";
import { liftListItem } from "@tiptap/pm/schema-list";
import {
  Plugin,
  PluginKey,
  Selection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import type { Step } from "@tiptap/pm/transform";

import {
  findEnclosingListItem,
  type EnclosingListItem,
} from "./note-list-nodes";

const CUT_UI_EVENT = "cut";
const MAX_LIFT_PASSES = 4;

export const noteCutListItemCleanupKey = new PluginKey(
  "noteCutListItemCleanup",
);

function liftItemOutOfList(
  state: EditorState,
  item: EnclosingListItem,
): Transaction | null {
  // `item.pos + 1` lands on the item boundary, which an emptied item resolves
  // to the item itself, so search for the nearest text position inside it.
  const inside = Selection.near(state.doc.resolve(item.pos + 1), 1);
  const scoped = state.apply(state.tr.setSelection(inside));
  let lifted: Transaction | null = null;
  liftListItem(item.node.type)(scoped, (tr) => {
    lifted = tr;
  });
  return lifted;
}

/**
 * Cutting all of a list item's text leaves the item behind, which keeps its
 * checkbox or bullet marker rendered. Lifting the emptied item out of its list
 * is exactly what Backspace does, so reuse that transform.
 */
export function liftEmptiedListItems(state: EditorState): Transaction | null {
  const steps: Step[] = [];
  let current = state;

  for (let pass = 0; pass < MAX_LIFT_PASSES; pass++) {
    const item = findEnclosingListItem(current.selection.$from);
    if (!item || !isNodeEmpty(item.node)) break;
    const lifted = liftItemOutOfList(current, item);
    if (!lifted) break;
    steps.push(...lifted.steps);
    current = current.apply(lifted);
  }

  if (steps.length === 0) return null;
  const tr = state.tr;
  steps.forEach((step) => tr.step(step));
  return tr.scrollIntoView();
}

function isCutTransaction(tr: Transaction) {
  return tr.getMeta("uiEvent") === CUT_UI_EVENT;
}

export function cutListItemCleanupPlugin() {
  return new Plugin({
    key: noteCutListItemCleanupKey,
    appendTransaction: (transactions, _oldState, newState) => {
      if (!transactions.some(isCutTransaction)) return null;
      return liftEmptiedListItems(newState);
    },
  });
}

/**
 * Scoped to cut so an empty item created by pressing Enter or Backspace stays
 * put.
 */
export const NoteCutListItemCleanup = Extension.create({
  name: "noteCutListItemCleanup",
  addProseMirrorPlugins() {
    return [cutListItemCleanupPlugin()];
  },
});
