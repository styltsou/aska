import { describe, expect, it } from "vitest";

import {
  consumeCanvasCardEntranceSuppression,
  suppressNextCanvasCardEntrance,
} from "./canvas-card-entrance";

describe("canvas card entrance suppression", () => {
  it("suppresses only the next entrance for a matching optimistic identity", () => {
    suppressNextCanvasCardEntrance("image-importing-dragged");

    expect(
      consumeCanvasCardEntranceSuppression("image-importing-imported"),
    ).toBe(false);
    expect(
      consumeCanvasCardEntranceSuppression("image-importing-dragged"),
    ).toBe(true);
    expect(
      consumeCanvasCardEntranceSuppression("image-importing-dragged"),
    ).toBe(false);
  });
});
