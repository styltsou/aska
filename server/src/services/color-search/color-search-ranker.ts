import {
  findMinimumCostColorAssignment,
  oklabDistance,
  type OklabColor,
  type SearchPaletteColor,
} from "./color-assignment";

export const COLOR_SEARCH_ALGORITHM_VERSION = "oklab-color-search-v1" as const;

export const COLOR_SEARCH_CONFIG = {
  candidateRadius: 0.16,
  maximumMatchDistance: 0.12,
  duplicateColorDistance: 0.008,
  sigma: 0.075,
  absoluteFloor: 0.24,
  relativeFloor: 0.4,
  maxResults: 50,
  maxBroadCandidates: 400,
} as const;

export type RankedPaletteMatch = {
  queryColorIndex: number;
  paletteHex: string;
  distance: number;
};

export type RankedColorSearchCandidate = {
  assetId: number;
  relevance: number;
  matches: RankedPaletteMatch[];
};

export function normalizeQueryColors<T extends OklabColor>(
  colors: readonly T[],
  duplicateDistance = COLOR_SEARCH_CONFIG.duplicateColorDistance,
): T[] {
  const normalized: T[] = [];

  for (const color of colors) {
    if (
      !normalized.some(
        (existing) => oklabDistance(existing, color) <= duplicateDistance,
      )
    ) {
      normalized.push(color);
    }
  }

  return normalized;
}

export function rankPalette(
  assetId: number,
  queryColors: readonly OklabColor[],
  paletteColors: readonly SearchPaletteColor[],
): RankedColorSearchCandidate | null {
  const assignment = findMinimumCostColorAssignment(
    queryColors,
    paletteColors,
    COLOR_SEARCH_CONFIG.candidateRadius,
  );
  if (
    !assignment ||
    assignment.matches.some(
      (match) => match.distance > COLOR_SEARCH_CONFIG.maximumMatchDistance,
    )
  ) {
    return null;
  }

  const matchScores = assignment.matches.map((match) => {
    const distanceScore = Math.exp(
      -0.5 * (match.distance / COLOR_SEARCH_CONFIG.sigma) ** 2,
    );
    const prominence =
      0.7 +
      0.15 * Math.sqrt(match.paletteColor.coverage) +
      0.15 * match.paletteColor.salience;
    return distanceScore * prominence;
  });

  const geometricMean = Math.exp(
    matchScores.reduce((sum, score) => sum + Math.log(score), 0) /
      matchScores.length,
  );
  const relevance = roundScore(
    0.8 * geometricMean + 0.2 * Math.min(...matchScores),
  );

  return {
    assetId,
    relevance,
    matches: assignment.matches.map((match) => ({
      queryColorIndex: match.queryColorIndex,
      paletteHex: match.paletteColor.hex,
      distance: roundScore(match.distance),
    })),
  };
}

export function applyAdaptiveCutoff<T extends RankedColorSearchCandidate>(
  candidates: readonly T[],
): { cutoff: number; results: T[] } {
  if (candidates.length === 0) {
    return { cutoff: COLOR_SEARCH_CONFIG.absoluteFloor, results: [] };
  }

  const sorted = [...candidates].sort(compareCandidates);
  const bestRelevance = sorted[0]!.relevance;
  const cutoff = roundScore(
    Math.max(
      COLOR_SEARCH_CONFIG.absoluteFloor,
      bestRelevance * COLOR_SEARCH_CONFIG.relativeFloor,
    ),
  );

  return {
    cutoff,
    results: sorted.filter((candidate) => candidate.relevance >= cutoff),
  };
}

export function compareCandidates(
  first: RankedColorSearchCandidate,
  second: RankedColorSearchCandidate,
): number {
  return second.relevance - first.relevance || second.assetId - first.assetId;
}

function roundScore(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
