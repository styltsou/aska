import { describe, expect, it } from "vitest";
import { getWorkspacePeekWidthBounds } from "./workspace-peek-width";

describe("workspace peek width", () => {
  it("leaves resizing room on a scaled laptop viewport", () => {
    expect(getWorkspacePeekWidthBounds(1280)).toEqual({
      min: 358,
      max: 640,
      defaultWidth: 461,
    });
  });

  it("retains a readable hard minimum on smaller desktop viewports", () => {
    expect(getWorkspacePeekWidthBounds(800)).toEqual({
      min: 320,
      max: 400,
      defaultWidth: 320,
    });
  });
});
