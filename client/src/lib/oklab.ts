export type OklabColor = {
  oklabL: number;
  oklabA: number;
  oklabB: number;
};

const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

/**
 * Converts a display sRGB hex color into the OKLab coordinates used by the
 * image pipeline and color-search API.
 */
export function hexToOklab(hex: string): OklabColor {
  const match = HEX_COLOR_PATTERN.exec(hex);
  if (!match) {
    throw new Error(`Expected a six-digit sRGB hex color, received: ${hex}`);
  }

  const value = match[1]!;
  const rgb = [0, 2, 4].map((offset) =>
    srgbToLinear(Number.parseInt(value.slice(offset, offset + 2), 16) / 255),
  );
  const [r, g, b] = rgb as [number, number, number];

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    oklabL: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    oklabA: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    oklabB: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}
