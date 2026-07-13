export const KEYBINDINGS = {
  THEME_TOGGLE: { key: "d", label: "D" },
  COMMAND_PALETTE_TOGGLE: { key: "k", label: "K", ctrlKey: true },
  FILTER_BAR_TOGGLE: { code: "KeyF", label: "F", shiftKey: true },
  SIDEBAR_TOGGLE: { key: "b", label: "B", metaOrCtrl: true },
  SCRATCHPAD_OPEN: { code: "KeyI", label: "I", shiftKey: true },
} as const;
