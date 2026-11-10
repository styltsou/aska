import { describe, expect, it } from "vitest";

import { activeCanvasObjectFocus } from "./canvas-object-focus";

describe("activeCanvasObjectFocus", () => {
  it("keeps explicit focus for a matching single selection", () => {
    expect(activeCanvasObjectFocus("text-1", ["text-1"])).toBe("text-1");
  });

  it("hides object focus for multi-selection", () => {
    expect(activeCanvasObjectFocus("text-1", ["text-1", "arrow-2"])).toBe(
      undefined,
    );
  });

  it("does not infer focus from selection alone", () => {
    expect(activeCanvasObjectFocus(undefined, ["text-1"])).toBe(undefined);
    expect(activeCanvasObjectFocus("arrow-2", ["text-1"])).toBe(undefined);
  });
});
