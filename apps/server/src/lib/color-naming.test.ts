import { describe, expect, it } from "vitest";
import { deriveColorNaming, matchesGradientNamingJob } from "./color-naming";
import { gradientFingerprint, normalizeColorGradient } from "./color-gradient";

const blue = normalizeColorGradient({
  from: "#003366",
  to: "#22ccaa",
  angle: 90,
  type: "linear",
});
const warm = normalizeColorGradient({
  from: "#ff2200",
  to: "#ffbb33",
  angle: 90,
  type: "linear",
});

describe("color title policy", () => {
  it("preserves a manual title and prompts after a major gradient edit", () => {
    const result = deriveColorNaming(
      {
        title: "My Sunset",
        gradient: blue,
        nameBasis: blue,
        nameEditedByUser: true,
      },
      { gradient: warm, hex: null, colorChanged: true, namingEnabled: true },
    );
    expect(result).toMatchObject({
      title: "My Sunset",
      manualTitle: true,
      shouldPrompt: true,
      shouldQueue: false,
      nameBasis: blue,
    });
  });

  it("queues a replacement for a changed automatic title", () => {
    const result = deriveColorNaming(
      {
        title: "Ocean Mist",
        gradient: blue,
        nameBasis: blue,
        nameEditedByUser: false,
      },
      { gradient: warm, hex: null, colorChanged: true, namingEnabled: true },
    );
    expect(result).toMatchObject({
      title: "Ocean Mist",
      shouldQueue: true,
      shouldPrompt: false,
      nameBasis: blue,
    });
  });

  it("clearing a title restores automatic naming", () => {
    const result = deriveColorNaming(
      {
        title: "My Sunset",
        gradient: warm,
        nameBasis: warm,
        nameEditedByUser: true,
      },
      {
        gradient: warm,
        hex: null,
        title: null,
        colorChanged: false,
        namingEnabled: true,
      },
    );
    expect(result).toMatchObject({
      title: "Linear Gradient",
      manualTitle: false,
      nameBasis: null,
      shouldQueue: true,
    });
  });

  it("keeps manually titled solid colors and does not prompt when naming is off", () => {
    const solid = deriveColorNaming(
      {
        title: "Brand Blue",
        gradient: null,
        nameBasis: null,
        nameEditedByUser: true,
      },
      {
        gradient: null,
        hex: "#ff0000",
        colorChanged: true,
        namingEnabled: false,
      },
    );
    expect(solid.title).toBe("Brand Blue");
    expect(solid.shouldPrompt).toBe(false);
    expect(solid.shouldQueue).toBe(false);
  });

  it("names an existing generic gradient on its next edit", () => {
    const result = deriveColorNaming(
      {
        title: "Linear Gradient",
        gradient: blue,
        nameBasis: null,
        nameEditedByUser: false,
      },
      { gradient: warm, hex: null, colorChanged: true, namingEnabled: true },
    );
    expect(result.shouldQueue).toBe(true);
  });

  it("rejects stale callbacks after a gradient or title change and duplicate results", () => {
    const job = {
      fingerprint: gradientFingerprint(blue),
      expectedTitle: "Linear Gradient",
      expectedManual: false,
    };
    const current = {
      title: "Linear Gradient",
      gradient: blue,
      nameBasis: null,
      nameEditedByUser: false,
    };
    expect(matchesGradientNamingJob(current, job)).toBe(true);
    expect(matchesGradientNamingJob({ ...current, gradient: warm }, job)).toBe(
      false,
    );
    expect(
      matchesGradientNamingJob({ ...current, title: "My Sunset" }, job),
    ).toBe(false);
    expect(matchesGradientNamingJob({ ...current, nameBasis: blue }, job)).toBe(
      false,
    );
  });
});
