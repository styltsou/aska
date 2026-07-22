export type OklabColor = {
  oklabL: number;
  oklabA: number;
  oklabB: number;
};

export type SearchPaletteColor = OklabColor & {
  id: number;
  hex: string;
  coverage: number;
  salience: number;
  isAccent: boolean;
};

export type ColorAssignmentMatch = {
  queryColorIndex: number;
  paletteColor: SearchPaletteColor;
  distance: number;
};

export type ColorAssignment = {
  matches: ColorAssignmentMatch[];
  totalDistance: number;
};

type AssignmentState = ColorAssignment & {
  tieEvidence: number;
};

const DISTANCE_EPSILON = 1e-12;

export function oklabDistance(first: OklabColor, second: OklabColor): number {
  return Math.hypot(
    first.oklabL - second.oklabL,
    first.oklabA - second.oklabA,
    first.oklabB - second.oklabB,
  );
}

/**
 * Finds a minimum-distance one-to-one assignment between requested and palette
 * colors. The bounded bitmask DP is small even for five query colors and a
 * sixteen-entry extracted palette.
 */
export function findMinimumCostColorAssignment(
  queryColors: readonly OklabColor[],
  paletteColors: readonly SearchPaletteColor[],
  maximumDistance: number,
): ColorAssignment | null {
  if (queryColors.length === 0 || queryColors.length > paletteColors.length) {
    return null;
  }

  let states = new Map<number, AssignmentState>();
  states.set(0, { matches: [], totalDistance: 0, tieEvidence: 0 });

  for (const [queryColorIndex, queryColor] of queryColors.entries()) {
    const nextStates = new Map<number, AssignmentState>();

    for (const [mask, state] of states) {
      for (const [paletteIndex, paletteColor] of paletteColors.entries()) {
        const bit = 1 << paletteIndex;
        if ((mask & bit) !== 0) continue;

        const distance = oklabDistance(queryColor, paletteColor);
        if (distance > maximumDistance) continue;

        const candidate: AssignmentState = {
          matches: [
            ...state.matches,
            { queryColorIndex, paletteColor, distance },
          ],
          totalDistance: state.totalDistance + distance,
          tieEvidence:
            state.tieEvidence + paletteColor.coverage + paletteColor.salience,
        };
        const nextMask = mask | bit;
        const current = nextStates.get(nextMask);
        if (!current || isBetterAssignment(candidate, current)) {
          nextStates.set(nextMask, candidate);
        }
      }
    }

    states = nextStates;
    if (states.size === 0) return null;
  }

  let best: AssignmentState | null = null;
  for (const state of states.values()) {
    if (!best || isBetterAssignment(state, best)) best = state;
  }

  return best
    ? { matches: best.matches, totalDistance: best.totalDistance }
    : null;
}

function isBetterAssignment(
  candidate: AssignmentState,
  current: AssignmentState,
): boolean {
  if (
    Math.abs(candidate.totalDistance - current.totalDistance) > DISTANCE_EPSILON
  ) {
    return candidate.totalDistance < current.totalDistance;
  }

  if (
    Math.abs(candidate.tieEvidence - current.tieEvidence) > DISTANCE_EPSILON
  ) {
    return candidate.tieEvidence > current.tieEvidence;
  }

  return assignmentSignature(candidate) < assignmentSignature(current);
}

function assignmentSignature(assignment: AssignmentState): string {
  return assignment.matches
    .map((match) => String(match.paletteColor.id).padStart(10, "0"))
    .join(":");
}
