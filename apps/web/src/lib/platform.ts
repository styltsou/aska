export function getPlatformModifier(): string {
  if (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac")
  ) {
    return "⌘";
  }
  return "Ctrl";
}

export function getPlatformAlt(): string {
  if (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac")
  ) {
    return "⌥";
  }
  return "Alt";
}

export function getPlatformShift(): string {
  if (
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac")
  ) {
    return "⇧";
  }
  return "Shift";
}

export function formatPlatformShortcut(shortcut: string): string {
  return shortcut
    .replace(/\u2318/g, getPlatformModifier())
    .replace(/\u21E7/g, getPlatformShift());
}
