import { describe, expect, it } from "vitest";

import { arrowHasIdentity, arrowIsSelected } from "./canvas-arrow-identity";

describe("canvas arrow identity", () => {
  it("does not match an absent object id to an absent client id", () => {
    expect(arrowHasIdentity({ id: "arrow-1" }, undefined)).toBe(false);
  });

  it("matches either the persisted id or a defined optimistic client id", () => {
    const arrow = { id: "arrow-1", clientId: "arrow-draft-1" };

    expect(arrowHasIdentity(arrow, "arrow-1")).toBe(true);
    expect(arrowHasIdentity(arrow, "arrow-draft-1")).toBe(true);
    expect(arrowHasIdentity(arrow, "arrow-2")).toBe(false);
  });

  it("selects by persisted or optimistic identity without matching undefined", () => {
    expect(arrowIsSelected({ id: "arrow-1" }, new Set(["arrow-1"]))).toBe(true);
    expect(
      arrowIsSelected(
        { id: "arrow-1", clientId: "arrow-draft-1" },
        new Set(["arrow-draft-1"]),
      ),
    ).toBe(true);
    expect(arrowIsSelected({ id: "arrow-1" }, new Set())).toBe(false);
  });
});
