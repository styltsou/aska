import { describe, expect, it } from "vitest";

import type { CollectionNode } from "@/api/collection";
import {
  BOARD_CARD_WIDTH,
  BOARD_ITEM_GAP,
  arrangeNodesInGrid,
  compactNodesInMasonry,
  getInitialNodePosition,
  reserveNodePositions,
} from "./canvas-node-layout";

const note: CollectionNode = {
  id: "note-1",
  type: "note",
  content: "Reference",
  color: null,
  isFavorite: false,
  wordCount: 1,
  readingTimeMinutes: 1,
  position: null,
};

const portraitImage: CollectionNode = {
  id: "portrait-image",
  type: "image",
  url: "https://example.com/portrait.jpg",
  width: 280,
  height: 560,
  title: null,
  alt: null,
  sourceLabel: null,
  sourceUrl: null,
  isFavorite: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  position: null,
};

describe("infinite canvas node placement", () => {
  it("preserves signed persisted positions without snapping", () => {
    expect(
      getInitialNodePosition({ ...note, position: { x: -137, y: 59 } }, 0),
    ).toEqual({ x: -137, y: 59 });
  });

  it("gives legacy nodes deterministic fallback positions", () => {
    expect(getInitialNodePosition(note, 0)).toEqual({ x: 48, y: 48 });
    expect(getInitialNodePosition(note, 5)).toEqual({ x: 48, y: 448 });
  });

  it("places a batch from the requested canvas coordinate", () => {
    expect(
      reserveNodePositions([], [note, { ...note, id: "note-2" }], {
        x: -51.4,
        y: 73.8,
      }),
    ).toEqual([
      { x: -51, y: 74 },
      { x: -51 + BOARD_CARD_WIDTH + BOARD_ITEM_GAP, y: 74 },
    ]);
  });

  it("moves a requested insertion only when it collides with an existing card", () => {
    const [position] = reserveNodePositions(
      [{ ...note, position: { x: 48, y: 48 } }],
      [{ ...note, id: "note-2" }],
      { x: 48, y: 48 },
    );

    expect(position).not.toEqual({ x: 48, y: 48 });
    expect(position!.x).not.toBe(48);
  });

  it("centers an unanchored insertion inside the visible board area", () => {
    expect(
      reserveNodePositions([], [note], {
        visibleBounds: { left: 0, top: 0, right: 1_000, bottom: 1_000 },
      }),
    ).toEqual([{ x: 360, y: 340 }]);
  });

  it("lays a visible batch out in rows before extending beyond the viewport", () => {
    expect(
      reserveNodePositions(
        [],
        [
          note,
          { ...note, id: "note-2" },
          { ...note, id: "note-3" },
          { ...note, id: "note-4" },
        ],
        {
          visibleBounds: { left: 0, top: 0, right: 1_000, bottom: 1_000 },
        },
      ),
    ).toEqual([
      { x: 48, y: 164 },
      { x: 360, y: 164 },
      { x: 672, y: 164 },
      { x: 48, y: 516 },
    ]);
  });

  it("gives concurrent single-card imports their batch grid positions", () => {
    const visibleBounds = { left: 0, top: 0, right: 1_000, bottom: 1_000 };

    expect(
      reserveNodePositions([], [note], {
        visibleBounds,
        batch: { index: 2, size: 4 },
      }),
    ).toEqual([{ x: 672, y: 164 }]);
  });

  it("keeps a context-menu insertion fully visible when the click is near an edge", () => {
    expect(
      reserveNodePositions([], [note], {
        position: { x: 900, y: 900 },
        visibleBounds: { left: 0, top: 0, right: 1_000, bottom: 1_000 },
      }),
    ).toEqual([{ x: 720, y: 680 }]);
  });

  it("arranges from the selection's top-left in row-banded reading order", () => {
    const nodes = [
      { ...note, id: "bottom-left", position: { x: 100, y: 500 } },
      { ...note, id: "top-right", position: { x: 500, y: 120 } },
      { ...note, id: "top-left", position: { x: 100, y: 100 } },
      { ...note, id: "bottom-right", position: { x: 500, y: 520 } },
    ];

    expect(arrangeNodesInGrid(nodes)).toEqual([
      { x: 100, y: 452 },
      { x: 412, y: 100 },
      { x: 100, y: 100 },
      { x: 412, y: 452 },
    ]);
  });

  it("uses measured card heights so the next grid row has only the shared gutter", () => {
    const nodes = [
      {
        ...note,
        id: "top-left",
        position: { x: 100, y: 100 },
        layoutHeight: 180,
      },
      {
        ...note,
        id: "top-right",
        position: { x: 412, y: 100 },
        layoutHeight: 80,
      },
      {
        ...note,
        id: "bottom-left",
        position: { x: 100, y: 500 },
        layoutHeight: 120,
      },
      {
        ...note,
        id: "bottom-right",
        position: { x: 412, y: 500 },
        layoutHeight: 120,
      },
    ];

    expect(arrangeNodesInGrid(nodes)).toEqual([
      { x: 100, y: 100 },
      { x: 412, y: 100 },
      { x: 100, y: 312 },
      { x: 412, y: 312 },
    ]);
  });

  it("does not shift the grid to avoid unselected nodes", () => {
    const selected = [
      { ...note, id: "first", position: { x: 48, y: 48 } },
      { ...note, id: "second", position: { x: 360, y: 48 } },
    ];

    expect(arrangeNodesInGrid(selected)).toEqual([
      { x: 48, y: 48 },
      { x: 360, y: 48 },
    ]);
  });

  it("compacts reading-order cards into the shortest masonry column", () => {
    const nodes = [
      { ...portraitImage, id: "tall", position: { x: 100, y: 100 } },
      {
        ...note,
        id: "short-one",
        position: { x: 412, y: 100 },
        layoutHeight: 100,
      },
      {
        ...note,
        id: "short-two",
        position: { x: 100, y: 500 },
        layoutHeight: 100,
      },
      {
        ...note,
        id: "short-three",
        position: { x: 412, y: 500 },
        layoutHeight: 100,
      },
    ];

    expect(compactNodesInMasonry(nodes)).toEqual([
      { x: 100, y: 100 },
      { x: 412, y: 100 },
      { x: 412, y: 232 },
      { x: 412, y: 364 },
    ]);
  });
});
