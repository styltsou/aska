export const KEYBINDINGS = {
  COMMAND_PALETTE_TOGGLE: { key: "k", label: "K", ctrlKey: true },
  FILTER_BAR_TOGGLE: { code: "KeyF", label: "F", shiftKey: true },
  SIDEBAR_TOGGLE: { key: "b", label: "B", metaOrCtrl: true },
  SCRATCHPAD_OPEN: { code: "KeyP", label: "P", shiftKey: true },
  SETTINGS_OPEN: { key: ",", label: ",", metaOrCtrl: true },
} as const;
