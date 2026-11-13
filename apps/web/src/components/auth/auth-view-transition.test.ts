import { describe, expect, it } from "vitest";
import { authHistoryTransitionTypes } from "./auth-view-transition";

describe("auth history transitions", () => {
  it("reverses on Back and moves left on Forward", () => {
    expect(authHistoryTransitionTypes("/signup", "/login", 2, 1)).toEqual([
      "auth-switch",
      "auth-reverse",
    ]);
    expect(authHistoryTransitionTypes("/login", "/signup", 1, 2)).toEqual([
      "auth-switch",
      "auth-forward",
    ]);
  });

  it("leaves navigation outside the auth flow alone", () => {
    expect(authHistoryTransitionTypes("/login", "/workspace", 1, 2)).toBe(
      false,
    );
    expect(authHistoryTransitionTypes(undefined, "/login", undefined, 0)).toBe(
      false,
    );
  });
});
