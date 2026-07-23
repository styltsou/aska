/**
 * Dominant-colour palette extraction.
 *
 * The pipeline clusters broad image coverage and high-chroma samples
 * separately, then measures every resulting colour against an unbiased sample
 * set. This keeps large backgrounds useful for colour search while preserving
 * visually meaningful small accents for moodboards and palette display.
 */

import {
  oklabChroma,
  oklabDistanceSquared,
  oklabToRgb,
  rgbToHex,
  type Oklab,
} from "./color";

/** Increment when the extraction algorithm or its persisted metrics change. */
export const PALETTE_EXTRACTION_VERSION = 2;

/** A palette colour with both search metrics and a display-ready CSS colour. */
export type ImagePaletteColor = Oklab & {
  hex: string;
  coverage: number;
  salience: number;
  isAccent: boolean;
};

/** Maximum clusters fitted to the proportionally sampled full image. */
const COVERAGE_CLUSTER_LIMIT = 6;
/** Maximum additional clusters fitted only to saturated candidate pixels. */
const ACCENT_CLUSTER_LIMIT = 4;
/** Minimum Oklab chroma required for a sample to be considered an accent. */
const ACCENT_CHROMA_THRESHOLD = 0.05;
/** Squared Oklab distance below which two candidate colours are collapsed. */
const MERGE_DISTANCE_SQUARED = 0.0016;
/** Minimum measured image coverage for a non-accent colour to be retained. */
const MINIMUM_COVERAGE = 0.002;
/** Hard upper bound for the palette persisted with an image. */
const MAXIMUM_PALETTE_COLORS = 10;
/** Chroma at which the normalized salience chroma contribution reaches one. */
const OKLAB_CHROMA_NORMALIZATION = 0.28;
/** Bounded iteration count prevents pathological K-means runs. */
const MAX_K_MEANS_ITERATIONS = 24;
/** Squared centroid movement below which K-means is considered converged. */
const K_MEANS_MOVEMENT_THRESHOLD = 1e-6;
/** Very small clusters are not split because BIC is not meaningful for them. */
const MIN_CLUSTER_MEMBERS_TO_SPLIT = 6;
/** Required BIC improvement before X-means accepts a cluster split. */
const BIC_IMPROVEMENT_THRESHOLD = 1e-6;
/** Relative salience contribution of the square-root coverage term. */
const SALIENCE_COVERAGE_WEIGHT = 0.55;
/** Relative salience contribution of normalized Oklab chroma. */
const SALIENCE_CHROMA_WEIGHT = 0.3;
/** Salience contribution for a colour independently discovered as an accent. */
const SALIENCE_ACCENT_BONUS = 0.15;

/** Assigns every sample to its closest centroid in Oklab space. */
function assignToNearest(samples: Oklab[], centroids: Oklab[]): number[] {
  return samples.map((sample) => {
    let nearest = 0;
    let nearestDistance = Infinity;

    for (let index = 0; index < centroids.length; index++) {
      const distance = oklabDistanceSquared(sample, centroids[index]!);

      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    }

    return nearest;
  });
}

/**
 * Picks deterministic, well-separated initial centroids.
 *
 * This avoids random initialisation, making equivalent inputs reproducible
 * across worker runs.
 */
function farthestFirst(samples: Oklab[], k: number): Oklab[] {
  const centroids = [{ ...samples[0]! }];
  const nearestDistances = Array.from(
    { length: samples.length },
    () => Infinity,
  );

  while (centroids.length < k) {
    let farthestIndex = 0;
    let farthestDistance = -1;
    const lastCentroid = centroids.at(-1)!;

    for (let index = 0; index < samples.length; index++) {
      nearestDistances[index] = Math.min(
        nearestDistances[index]!,
        oklabDistanceSquared(samples[index]!, lastCentroid),
      );

      if (nearestDistances[index]! > farthestDistance) {
        farthestDistance = nearestDistances[index]!;
        farthestIndex = index;
      }
    }

    centroids.push({ ...samples[farthestIndex]! });
  }

  return centroids;
}

/** Runs bounded K-means and returns its converged centroids and sample labels. */
function runKMeans(
  samples: Oklab[],
  k: number,
  initialCentroids = farthestFirst(samples, k),
) {
  let centroids = initialCentroids;
  let labels = assignToNearest(samples, centroids);

  for (let iteration = 0; iteration < MAX_K_MEANS_ITERATIONS; iteration++) {
    const sums = Array.from({ length: k }, () => ({
      l: 0,
      a: 0,
      b: 0,
      count: 0,
    }));

    for (let index = 0; index < samples.length; index++) {
      const sample = samples[index]!;
      const sum = sums[labels[index]!]!;

      sum.l += sample.oklabL;
      sum.a += sample.oklabA;
      sum.b += sample.oklabB;
      sum.count++;
    }

    const nextCentroids = sums.map((sum, index) =>
      sum.count === 0
        ? centroids[index]!
        : {
            oklabL: sum.l / sum.count,
            oklabA: sum.a / sum.count,
            oklabB: sum.b / sum.count,
          },
    );
    const movement = Math.max(
      ...centroids.map((centroid, index) =>
        oklabDistanceSquared(centroid, nextCentroids[index]!),
      ),
    );

    centroids = nextCentroids;
    labels = assignToNearest(samples, centroids);

    if (movement < K_MEANS_MOVEMENT_THRESHOLD) break;
  }

  return { centroids, labels };
}

/** Calculates the Bayesian information criterion used to decide whether a split improves the model. */
function bic(samples: Oklab[], centroids: Oklab[], labels: number[]): number {
  let squaredError = 0;

  for (let index = 0; index < samples.length; index++) {
    squaredError += oklabDistanceSquared(
      samples[index]!,
      centroids[labels[index]!]!,
    );
  }

  if (squaredError === 0) return -Infinity;

  return (
    samples.length * Math.log(squaredError / samples.length) +
    centroids.length * 3 * Math.log(samples.length)
  );
}

/**
 * Uses X-means to choose a useful cluster count up to `maxK`.
 *
 * Each accepted split must improve BIC, which prevents the palette from adding
 * visually redundant colours merely because the maximum permits them.
 */
function xMeansCluster(
  samples: Oklab[],
  maxK: number,
): { centroids: Oklab[]; labels: number[] } {
  if (samples.length === 1)
    return { centroids: [{ ...samples[0]! }], labels: [0] };

  let result = runKMeans(samples, Math.min(2, samples.length));

  while (result.centroids.length < maxK) {
    const baseline = bic(samples, result.centroids, result.labels);
    let best = baseline;
    let replacement: Oklab[] | null = null;

    for (let index = 0; index < result.centroids.length; index++) {
      const members = samples.filter(
        (_, sampleIndex) => result.labels[sampleIndex] === index,
      );

      if (members.length < MIN_CLUSTER_MEMBERS_TO_SPLIT) continue;

      const split = runKMeans(members, 2);
      const candidate = [
        ...result.centroids.slice(0, index),
        ...result.centroids.slice(index + 1),
        ...split.centroids,
      ];
      const candidateLabels = assignToNearest(samples, candidate);
      const candidateBic = bic(samples, candidate, candidateLabels);

      if (candidateBic < best - BIC_IMPROVEMENT_THRESHOLD) {
        best = candidateBic;
        replacement = candidate;
      }
    }

    if (!replacement) break;

    result = runKMeans(samples, replacement.length, replacement);
  }

  return result;
}

type PaletteCandidate = { color: Oklab; isAccent: boolean };

/** Merges visually indistinguishable candidates while retaining their accent classification. */
function mergeCandidates(candidates: PaletteCandidate[]): PaletteCandidate[] {
  const merged: PaletteCandidate[] = [];

  for (const candidate of candidates) {
    const existing = merged.find(
      (entry) =>
        oklabDistanceSquared(entry.color, candidate.color) <
        MERGE_DISTANCE_SQUARED,
    );

    if (existing) {
      existing.isAccent ||= candidate.isAccent;
    } else {
      merged.push({ color: candidate.color, isAccent: candidate.isAccent });
    }
  }

  return merged;
}

/** Returns whether a colour is sufficiently saturated to participate in accent discovery. */
export function isAccentSample(color: Oklab): boolean {
  return oklabChroma(color) >= ACCENT_CHROMA_THRESHOLD;
}

/**
 * Extracts a search-oriented palette from separately sampled image pixels.
 *
 * `coverageSamples` represent the full image; `accentSamples` deliberately
 * favour saturated detail; `measurementSamples` provide unbiased coverage for
 * the persisted `coverage` metric.
 */
export function extractPaletteFromSamples(
  coverageSamples: Oklab[],
  accentSamples: Oklab[],
  measurementSamples = coverageSamples,
): ImagePaletteColor[] {
  if (coverageSamples.length === 0) return [];

  const coverageClusters = xMeansCluster(
    coverageSamples,
    COVERAGE_CLUSTER_LIMIT,
  ).centroids;
  const accentClusters =
    accentSamples.length > 0
      ? xMeansCluster(accentSamples, ACCENT_CLUSTER_LIMIT).centroids
      : [];
  const candidates = mergeCandidates([
    ...coverageClusters.map((color) => ({ color, isAccent: false })),
    ...accentClusters.map((color) => ({ color, isAccent: true })),
  ]).slice(0, COVERAGE_CLUSTER_LIMIT + ACCENT_CLUSTER_LIMIT);
  const labels = assignToNearest(
    measurementSamples,
    candidates.map((candidate) => candidate.color),
  );
  const counts = Array.from({ length: candidates.length }, () => 0);

  for (const label of labels) counts[label]!++;

  return candidates
    .map((candidate, index) => {
      const coverage = counts[index]! / measurementSamples.length;
      const chromaScore = Math.min(
        1,
        oklabChroma(candidate.color) / OKLAB_CHROMA_NORMALIZATION,
      );
      const isAccent = candidate.isAccent && isAccentSample(candidate.color);
      const salience = Math.min(
        1,
        SALIENCE_COVERAGE_WEIGHT * Math.sqrt(coverage) +
          SALIENCE_CHROMA_WEIGHT * chromaScore +
          (isAccent ? SALIENCE_ACCENT_BONUS : 0),
      );

      return {
        hex: rgbToHex(oklabToRgb(candidate.color)),
        ...candidate.color,
        coverage,
        salience,
        isAccent,
      };
    })
    .filter((color) => color.coverage >= MINIMUM_COVERAGE || color.isAccent)
    .sort((a, b) => b.salience - a.salience || b.coverage - a.coverage)
    .slice(0, MAXIMUM_PALETTE_COLORS);
}
