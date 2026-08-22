import { hexToOklab, type OklabColor } from "@/lib/oklab";
import type { ColorAsset } from "@/types/asset";

export type WeightedSearchColor = OklabColor & { weight: number };

const DUPLICATE_DISTANCE = 0.008;

export function colorAssetToSearchColors(
  asset: ColorAsset,
): WeightedSearchColor[] {
  if (!asset.gradient) {
    return [{ ...hexToOklab(normalizeHex(asset.hex)), weight: 1 }];
  }

  const stops = (
    asset.gradient.stops ?? [
      { color: asset.gradient.from, position: 0 },
      { color: asset.gradient.to, position: 100 },
    ]
  )
    .map((stop) => ({ ...stop, color: normalizeHex(stop.color) }))
    .sort((first, second) => first.position - second.position);
  const weighted = stops.map((stop, index) => {
    const previous = stops[index - 1]?.position ?? stop.position;
    const next = stops[index + 1]?.position ?? stop.position;
    const weight = Math.max(1, (next - previous) / 2);
    return { ...hexToOklab(stop.color), weight };
  });

  const deduplicated: WeightedSearchColor[] = [];
  for (const color of weighted) {
    const existing = deduplicated.find(
      (candidate) => oklabDistance(candidate, color) <= DUPLICATE_DISTANCE,
    );
    if (existing) existing.weight += color.weight;
    else deduplicated.push(color);
  }
  const totalWeight = deduplicated.reduce(
    (sum, color) => sum + color.weight,
    0,
  );
  return deduplicated.map((color) => ({
    ...color,
    weight: color.weight / totalWeight,
  }));
}

function normalizeHex(hex: string): string {
  const value = hex.slice(1);
  const opaque =
    value.length === 3 || value.length === 4
      ? `${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`
      : value.slice(0, 6);
  return `#${opaque}`;
}

function oklabDistance(first: OklabColor, second: OklabColor): number {
  return Math.hypot(
    first.oklabL - second.oklabL,
    first.oklabA - second.oklabA,
    first.oklabB - second.oklabB,
  );
}
