export type GlobalShortcut =
  | "toggle-command-palette"
  | "new-note"
  | "new-folder"
  | "upload-images"
  | "toggle-filter-bar"
  | "open-scratchpad"
  | "toggle-collection-view"
  | "toggle-sidebar"
  | "open-settings";

export interface Keybinding {
  command: GlobalShortcut;
  code?: string;
  key?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  metaOrCtrl?: boolean;
  altKey?: boolean;
}

export const KEYBINDINGS: Keybinding[] = [
  { command: "toggle-command-palette", key: "k", metaOrCtrl: true },
  { command: "new-note", code: "KeyN", shiftKey: true },
  { command: "new-folder", code: "KeyD", shiftKey: true },
  { command: "upload-images", code: "KeyU", shiftKey: true },
  { command: "toggle-filter-bar", code: "KeyF", shiftKey: true },
  { command: "open-scratchpad", code: "KeyP", shiftKey: true },
  { command: "toggle-collection-view", code: "KeyV", shiftKey: true },
  { command: "toggle-sidebar", key: "b", metaOrCtrl: true },
  { command: "open-settings", key: ",", metaOrCtrl: true },
];

export function matchesKeybinding(
  event: KeyboardEvent,
  kb: Keybinding,
): boolean {
  if (kb.code !== undefined) {
    if (event.code !== kb.code) return false;
  } else if (kb.key !== undefined) {
    if (event.key.toLowerCase() !== kb.key.toLowerCase()) return false;
  } else {
    return false;
  }

  if (kb.shiftKey && !event.shiftKey) return false;
  if (kb.ctrlKey && !event.ctrlKey) return false;
  if (kb.metaKey && !event.metaKey) return false;
  if (kb.metaOrCtrl && !(event.metaKey || event.ctrlKey)) return false;
  if (kb.altKey && !event.altKey) return false;

  return true;
}

export function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}
