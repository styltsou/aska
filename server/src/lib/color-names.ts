import namer from "color-namer";

const HEX_PATTERN = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * Normalizes any accepted hex input into the canonical stored form:
 * lowercase, 6-digit when opaque, 8-digit only when transparency is present.
 */
export function normalizeHexColor(input: string): string {
  const raw = input.replace(/^#/, "").toLowerCase();

  if (raw.length === 3 || raw.length === 4) {
    return `#${[...raw].map((char) => char + char).join("")}`;
  }

  return `#${raw}`;
}

/** Returns true when the whole string is a hex color token. */
export function isHexColor(input: string): boolean {
  return HEX_PATTERN.test(input.trim());
}

/**
 * Names a color using the ntc dictionary (~1500 curated names) with
 * perceptual Delta-E matching. Alpha is ignored: names describe the RGB
 * identity of the color.
 */
export function getColorName(hex: string): string | null {
  const [match] = namer(hex.slice(0, 7), {
    pick: ["ntc"],
    distance: "deltae",
  }).ntc;
  return match?.name ?? null;
}
