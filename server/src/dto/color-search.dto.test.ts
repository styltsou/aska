import { describe, expect, it } from "vitest";

import { ColorSearchRequestSchema } from "./color-search.dto";

const color = { oklabL: 0.628, oklabA: 0.225, oklabB: 0.126 };

describe("ColorSearchRequestSchema", () => {
  it("accepts Inbox and direct collection-board scopes", () => {
    expect(
      ColorSearchRequestSchema.safeParse({
        colors: [color],
        scope: { type: "inbox" },
      }).success,
    ).toBe(true);
    expect(
      ColorSearchRequestSchema.safeParse({
        colors: [color],
        scope: {
          type: "collection",
          collectionSlug: "summer-campaign",
          folderPath: "packaging",
          includeDescendants: false,
        },
      }).success,
    ).toBe(true);
  });

  it("rejects invalid color counts, non-finite values, and unsupported scopes", () => {
    expect(
      ColorSearchRequestSchema.safeParse({
        colors: [],
        scope: { type: "inbox" },
      }).success,
    ).toBe(false);
    expect(
      ColorSearchRequestSchema.safeParse({
        colors: Array.from({ length: 6 }, () => color),
        scope: { type: "inbox" },
      }).success,
    ).toBe(false);
    expect(
      ColorSearchRequestSchema.safeParse({
        colors: [{ ...color, oklabL: Infinity }],
        scope: { type: "inbox" },
      }).success,
    ).toBe(false);
    expect(
      ColorSearchRequestSchema.safeParse({
        colors: [color],
        scope: { type: "workspace" },
      }).success,
    ).toBe(false);
    expect(
      ColorSearchRequestSchema.safeParse({
        colors: [color],
        scope: {
          type: "collection",
          collectionSlug: "summer-campaign",
          includeDescendants: true,
        },
      }).success,
    ).toBe(false);
  });
});
