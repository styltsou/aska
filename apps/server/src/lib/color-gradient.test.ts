import { describe, expect, it } from "vitest";
import {
  gradientFingerprint,
  isMajorGradientChange,
  normalizeColorGradient,
} from "./color-gradient";

const ocean = normalizeColorGradient({
  from: "#003366",
  to: "#22ccaa",
  angle: 90,
  type: "linear",
  stops: [
    { color: "#003366", position: 0 },
    { color: "#22ccaa", position: 100 },
  ],
});

describe("gradient naming change detection", () => {
  it("treats large color changes and a type switch as major", () => {
    expect(
      isMajorGradientChange(
        ocean,
        normalizeColorGradient({
          ...ocean,
          from: "#ff2200",
          to: "#ffbb33",
          stops: [
            { color: "#ff2200", position: 0 },
            { color: "#ffbb33", position: 100 },
          ],
        }),
      ),
    ).toBe(true);
    expect(isMajorGradientChange(ocean, { ...ocean, type: "radial" })).toBe(
      true,
    );
  });

  it("keeps tiny edits, but detects cumulative drift from the saved baseline", () => {
    const first = {
      ...ocean,
      stops: [
        { color: "#0a406d", position: 0 },
        { color: "#30c5a9", position: 100 },
      ],
    };
    const far = {
      ...ocean,
      stops: [
        { color: "#904000", position: 0 },
        { color: "#ffb020", position: 100 },
      ],
    };
    expect(isMajorGradientChange(ocean, first)).toBe(false);
    expect(isMajorGradientChange(ocean, far)).toBe(true);
  });

  it("includes stop positions and meaningful angle changes", () => {
    expect(
      isMajorGradientChange(ocean, {
        ...ocean,
        stops: [
          { color: "#003366", position: 0 },
          { color: "#22ccaa", position: 20 },
        ],
      }),
    ).toBe(true);
    expect(isMajorGradientChange(ocean, { ...ocean, angle: 180 })).toBe(true);
    expect(isMajorGradientChange(ocean, { ...ocean, angle: 100 })).toBe(false);
    const centerAccent = normalizeColorGradient({
      from: "#222222",
      to: "#222222",
      angle: 0,
      stops: [
        { color: "#222222", position: 0 },
        { color: "#ffffff", position: 50 },
        { color: "#222222", position: 100 },
      ],
    });
    expect(
      isMajorGradientChange(centerAccent, { ...centerAccent, angle: 90 }),
    ).toBe(true);
  });

  it("uses normalized stops for stale-result fingerprints", () => {
    expect(gradientFingerprint(ocean)).toBe(
      gradientFingerprint(
        normalizeColorGradient({
          ...ocean,
          from: "#036",
          stops: [...ocean.stops!].reverse(),
        }),
      ),
    );
  });
});
