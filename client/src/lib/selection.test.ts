import { describe, expect, it } from "vitest";

import { isPersistedSelectableAsset, rectFullyContains } from "./selection";

describe("selection helpers", () => {
  it("excludes pending images and optimistic notes", () => {
    expect(
      isPersistedSelectableAsset({
        id: "image-1",
        type: "image",
        uploadStatus: "processing",
      }),
    ).toBe(false);
    expect(
      isPersistedSelectableAsset({
        id: "note-optimistic-1",
        type: "note",
      }),
    ).toBe(false);
    expect(isPersistedSelectableAsset({ id: "folder-1", type: "folder" })).toBe(
      true,
    );
  });

  it("requires complete rectangle containment while accepting equal edges", () => {
    const outer = { left: 10, top: 20, right: 100, bottom: 120 };
    expect(rectFullyContains(outer, outer)).toBe(true);
    expect(
      rectFullyContains(outer, { left: 9, top: 20, right: 100, bottom: 120 }),
    ).toBe(false);
    expect(
      rectFullyContains(outer, { left: 10, top: 20, right: 101, bottom: 120 }),
    ).toBe(false);
  });
});
