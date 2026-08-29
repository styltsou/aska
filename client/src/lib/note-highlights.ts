export const NOTE_HIGHLIGHT_COLORS = [
  {
    value: "amber",
    label: "Amber",
    light: "oklch(0.90 0.08 82)",
    dark: "oklch(0.63 0.10 82 / 0.45)",
  },
  {
    value: "mint",
    label: "Mint",
    light: "oklch(0.90 0.06 160)",
    dark: "oklch(0.62 0.08 160 / 0.45)",
  },
  {
    value: "sky",
    label: "Sky",
    light: "oklch(0.90 0.055 240)",
    dark: "oklch(0.64 0.07 240 / 0.45)",
  },
  {
    value: "rose",
    label: "Rose",
    light: "oklch(0.91 0.055 20)",
    dark: "oklch(0.65 0.07 20 / 0.45)",
  },
  {
    value: "lavender",
    label: "Lavender",
    light: "oklch(0.90 0.05 300)",
    dark: "oklch(0.64 0.06 300 / 0.45)",
  },
] as const;

export type NoteHighlightColor =
  (typeof NOTE_HIGHLIGHT_COLORS)[number]["value"];

export function isNoteHighlightColor(
  value: unknown,
): value is NoteHighlightColor {
  return NOTE_HIGHLIGHT_COLORS.some((color) => color.value === value);
}
