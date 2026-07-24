import { describe, expect, it } from "vitest";

import {
  getFolderMovePosition,
  type MovePlacementNode,
} from "./collection-move-placement";

const movedNote: MovePlacementNode = {
  nodeType: "asset",
  assetType: "note",
  imageWidth: null,
  imageHeight: null,
  positionX: null,
  positionY: null,
};

const folderAt = (x: number, y: number): MovePlacementNode => ({
  nodeType: "folder",
  assetType: null,
  imageWidth: null,
  imageHeight: null,
  positionX: x,
  positionY: y,
});

describe("folder move placement", () => {
  it("uses the entry point for an empty destination", () => {
    expect(getFolderMovePosition([], movedNote)).toEqual({ x: 48, y: 48 });
  });

  it("uses a collision-free centre within the destination composition", () => {
    expect(
      getFolderMovePosition(
        [
          folderAt(0, 0),
          folderAt(624, 0),
          folderAt(0, 624),
          folderAt(624, 624),
        ],
        movedNote,
      ),
    ).toEqual({ x: 312, y: 292 });
  });

  it("uses the composition centre when no collision-free slot exists", () => {
    expect(getFolderMovePosition([folderAt(100, 100)], movedNote)).toEqual({
      x: 100,
      y: 80,
    });
  });
});
