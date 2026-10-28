import { describe, expect, it } from "vitest";
import { decodeGridCursor, encodeGridCursor } from "./grid-cursor";

describe("grid cursor", () => {
  it("preserves sub-millisecond timestamp precision and the node tie-breaker", () => {
    const timestamp = "2026-10-29 12:34:56.123456";
    expect(decodeGridCursor(encodeGridCursor(timestamp, 42))).toEqual({
      timestamp,
      nodeId: 42,
    });
  });

  it("rejects malformed cursors", () => {
    expect(decodeGridCursor("bad")).toBeNull();
    expect(
      decodeGridCursor(encodeGridCursor("2026-99-99 12:34:56", 42)),
    ).toBeNull();
  });
});
