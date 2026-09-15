import { describe, expect, it } from "vitest";

import {
  MAX_CANVAS_FRONT_INDEX,
  planCanvasFrontIndexUpdates,
} from "./canvas-stacking-order";

describe("canvas stacking order", () => {
  it("places requested items above the existing maximum", () => {
    expect(
      planCanvasFrontIndexUpdates(
        [
          { id: "note-1", frontIndex: 2 },
          { id: "text-2", frontIndex: 8 },
        ],
        ["image-3", "note-1"],
      ),
    ).toEqual([
      { id: "image-3", frontIndex: 9 },
      { id: "note-1", frontIndex: 10 },
    ]);
  });

  it("rebases retained items before assigning the requested group", () => {
    expect(
      planCanvasFrontIndexUpdates(
        [
          { id: "note-1", frontIndex: MAX_CANVAS_FRONT_INDEX },
          { id: "text-2", frontIndex: 4 },
          { id: "image-3", frontIndex: 12 },
        ],
        ["image-3", "text-2"],
      ),
    ).toEqual([
      { id: "note-1", frontIndex: 0 },
      { id: "image-3", frontIndex: 1 },
      { id: "text-2", frontIndex: 2 },
    ]);
  });
});
