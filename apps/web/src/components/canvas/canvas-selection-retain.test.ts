import { describe, expect, it } from "vitest";

import { retainSelectableIds } from "./canvas-selection-retain";

describe("retainSelectableIds", () => {
  it("keeps ids that are currently eligible", () => {
    expect(
      retainSelectableIds(
        ["a"],
        new Set(["a"]),
        new Set<string>(),
        new Set<string>(),
      ),
    ).toEqual(["a"]);
  });

  it("keeps in-flight optimistic ids before parent props catch up", () => {
    expect(
      retainSelectableIds(
        ["arrow-draft-1"],
        new Set<string>(),
        new Set<string>(),
        new Set<string>(),
      ),
    ).toEqual(["arrow-draft-1"]);
  });

  it("keeps pending ids even when they were eligible before a stale refetch", () => {
    expect(
      retainSelectableIds(
        ["arrow-draft-1"],
        new Set<string>(),
        new Set(["arrow-draft-1"]),
        new Set(["arrow-draft-1"]),
      ),
    ).toEqual(["arrow-draft-1"]);
  });

  it("drops ids that were eligible and are no longer", () => {
    expect(
      retainSelectableIds(
        ["a", "b"],
        new Set(["b"]),
        new Set(["a", "b"]),
        new Set<string>(),
      ),
    ).toEqual(["b"]);
  });

  it("drops nothing when every id is eligible", () => {
    expect(
      retainSelectableIds(
        ["a", "b"],
        new Set(["a", "b"]),
        new Set(["a"]),
        new Set<string>(),
      ),
    ).toEqual(["a", "b"]);
  });
});
