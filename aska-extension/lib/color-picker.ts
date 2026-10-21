export const START_COLOR_PICKER = "aska:start-color-picker";
export const CAPTURE_COLOR_PICKER = "aska:capture-color-picker";
export const PENDING_COLOR_KEY = "askaPendingColor";

export interface PendingColor {
  hex: string;
  pickedAt: string;
}

export function isPendingColor(value: unknown): value is PendingColor {
  if (!value || typeof value !== "object") return false;
  const color = value as Partial<PendingColor>;
  return (
    typeof color.hex === "string" &&
    /^#[0-9a-f]{6}$/i.test(color.hex) &&
    typeof color.pickedAt === "string"
  );
}

export function rgbToHex(red: number, green: number, blue: number): string {
  return (
    "#" +
    [red, green, blue]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function colorFormats(hex: string): { rgb: string; hsl: string } {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;
  let saturation = 0;

  if (difference !== 0) {
    saturation = difference / (1 - Math.abs(2 * lightness - 1));
    switch (maximum) {
      case r:
        hue = ((g - b) / difference) % 6;
        break;
      case g:
        hue = (b - r) / difference + 2;
        break;
      default:
        hue = (r - g) / difference + 4;
    }
    hue = (hue * 60 + 360) % 360;
  }

  return {
    rgb: "rgb(" + red + ", " + green + ", " + blue + ")",
    hsl:
      "hsl(" +
      Math.round(hue) +
      " " +
      Math.round(saturation * 100) +
      "% " +
      Math.round(lightness * 100) +
      "%)",
  };
}
