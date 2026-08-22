import { normalizeHexColor } from "@/lib/color-names";

export type StoredColorGradient = {
  from: string;
  to: string;
  angle: number;
  type?: "linear" | "radial";
  stops?: Array<{ color: string; position: number }>;
};

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
