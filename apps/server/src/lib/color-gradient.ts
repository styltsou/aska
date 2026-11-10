import { normalizeHexColor } from "@/lib/color-names";
import { createHash } from "node:crypto";

export type StoredColorGradient = {
  from: string;
  to: string;
  angle: number;
  type?: "linear" | "radial";
  stops?: Array<{ color: string; position: number }>;
};

export function getColorGradientTitle(
  gradient: Pick<StoredColorGradient, "type">,
) {
  return `${gradient.type === "radial" ? "Radial" : "Linear"} Gradient`;
}

type ColorGradientInput = Omit<StoredColorGradient, "type" | "stops"> & {
  type?: "linear" | "radial" | undefined;
  stops?: Array<{ color: string; position: number }> | undefined;
};

export function normalizeColorGradient(
  gradient: ColorGradientInput,
): StoredColorGradient {
  const stops = gradient.stops
    ?.map((stop) => ({
      color: normalizeHexColor(stop.color),
      position: stop.position,
    }))
    .sort((a, b) => a.position - b.position);

  return {
    from: normalizeHexColor(gradient.from),
    to: normalizeHexColor(gradient.to),
    angle: gradient.angle,
    ...(gradient.type ? { type: gradient.type } : {}),
    ...(stops ? { stops } : {}),
  };
}

export function gradientFingerprint(gradient: StoredColorGradient): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizeColorGradient(gradient)))
    .digest("hex");
}

function stopsFor(gradient: StoredColorGradient) {
  return gradient.stops?.length
    ? gradient.stops
    : [
        { color: gradient.from, position: 0 },
        { color: gradient.to, position: 100 },
      ];
}

function hexToOklab(hex: string): [number, number, number, number] {
  const rgb = [1, 3, 5].map(
    (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
  );
  const [r, g, b] = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const l = Math.cbrt(
    0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!,
  );
  const m = Math.cbrt(
    0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!,
  );
  const s = Math.cbrt(
    0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    hex.length === 9 ? Number.parseInt(hex.slice(7), 16) / 255 : 1,
  ];
}

function sampleGradient(gradient: StoredColorGradient, position: number) {
  const stops = stopsFor(gradient);
  let left = stops[0]!;
  let right = stops.at(-1)!;
  for (let index = 1; index < stops.length; index++) {
    if (stops[index]!.position >= position) {
      right = stops[index]!;
      left = stops[index - 1]!;
      break;
    }
  }
  const start = hexToOklab(left.color);
  const end = hexToOklab(right.color);
  const t =
    right.position === left.position
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (position - left.position) / (right.position - left.position),
          ),
        );
  return start.map((value, index) => value + (end[index]! - value) * t);
}

function distance(a: number[], b: number[]): number {
  return Math.hypot(
    a[0]! - b[0]!,
    a[1]! - b[1]!,
    a[2]! - b[2]!,
    (a[3]! - b[3]!) * 0.5,
  );
}

/** Compares the visible blend with the gradient described by the current title. */
export function isMajorGradientChange(
  basis: StoredColorGradient | null,
  next: StoredColorGradient,
): boolean {
  if (!basis) return true;
  if ((basis.type ?? "linear") !== (next.type ?? "linear")) return true;
  const positions = Array.from({ length: 21 }, (_, index) => index * 5);
  const distances = positions.map((position) =>
    distance(sampleGradient(basis, position), sampleGradient(next, position)),
  );
  if (Math.max(...distances) >= 0.18) return true;
  if (
    distances.reduce((sum, value) => sum + value, 0) / distances.length >=
    0.1
  )
    return true;
  const angle = Math.abs(basis.angle - next.angle);
  const angleDelta = Math.min(angle, 360 - angle);
  if (angleDelta < 90) return false;
  const first = sampleGradient(next, 0);
  return positions.some(
    (position) => distance(first, sampleGradient(next, position)) >= 0.12,
  );
}
