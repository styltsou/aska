export type SelectionCandidate = {
  id: string;
  type: string;
  uploadStatus?: unknown;
};

export function hasSelectionModifier(
  event: Pick<KeyboardEvent | MouseEvent, "ctrlKey" | "metaKey">,
): boolean {
  return event.ctrlKey || event.metaKey;
}

export function isSelectionShortcut(event: KeyboardEvent): boolean {
  return hasSelectionModifier(event) && event.key.toLowerCase() === "a";
}

export function isSelectionShortcutBlocked(
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu'], [data-selection-shortcut-block]",
    ),
  );
}

export function isPersistedSelectableAsset(asset: SelectionCandidate): boolean {
  return !(
    asset.uploadStatus !== undefined ||
    (asset.type === "note" && asset.id.startsWith("note-optimistic-"))
  );
}

export type Rect = Pick<DOMRect, "top" | "right" | "bottom" | "left">;

export function rectFullyContains(outer: Rect, inner: Rect): boolean {
  return (
    outer.left <= inner.left &&
    outer.right >= inner.right &&
    outer.top <= inner.top &&
    outer.bottom >= inner.bottom
  );
}

export function selectionIdsForScope(
  selection: { scopeKey: string | null; nodeIds: string[] },
  scopeKey: string,
): string[] {
  return selection.scopeKey === scopeKey ? selection.nodeIds : [];
}
