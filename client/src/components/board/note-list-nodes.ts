import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";

export type EnclosingListItem = {
  node: ProseMirrorNode;
  depth: number;
  pos: number;
};

function hasGroup(node: ProseMirrorNode, group: string) {
  const spec = node.type.spec.group;
  return typeof spec === "string" && spec.split(/\s+/).includes(group);
}

/**
 * List containers (`bulletList`, `orderedList`, `taskList`, and any custom list
 * extension) all declare the `list` group, while their item nodes do not. This
 * keeps list detection independent of node names.
 */
export function isListContainer(node: ProseMirrorNode | null | undefined) {
  return node ? hasGroup(node, "list") : false;
}

/**
 * The innermost list item wrapping `$pos`, or `null` when the position is not
 * inside a list. `pos` is the position directly before the item.
 */
export function findEnclosingListItem(
  $pos: ResolvedPos,
): EnclosingListItem | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if (!isListContainer($pos.node(depth - 1))) continue;
    return { node: $pos.node(depth), depth, pos: $pos.before(depth) };
  }
  return null;
}
