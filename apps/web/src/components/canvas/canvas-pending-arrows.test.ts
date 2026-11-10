import { describe, expect, it } from "vitest";

import type { CanvasArrowObject } from "@/api/collection";

import { visibleCanvasObjects } from "./canvas-pending-arrows";

const pending: CanvasArrowObject = {
  id: "arrow-draft-1",
  clientId: "arrow-draft-1",
  type: "arrow",
  start: { position: { x: 0, y: 0 } },
  end: { position: { x: 100, y: 0 } },
  style: "clean",
  pattern: "solid",
  head: "filled",
  routing: "straight",
  points: [],
  rotation: 0,
  color: "ink",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("visibleCanvasObjects", () => {
  it("provides one selectable arrow throughout the creation handoff", () => {
    const selectedId = pending.id;
    const pendingArrows = { [selectedId]: { object: pending } };
    const optimistic = { ...pending, end: { position: { x: 120, y: 0 } } };
    const persisted = { ...optimistic, id: "arrow-42" };

    for (const [cached, expected] of [
      [[], pending],
      [[optimistic], optimistic],
      [[persisted], persisted],
    ] as const) {
      const visible = visibleCanvasObjects(cached, pendingArrows);
      expect(visible).toHaveLength(1);
      expect(
        visible.find(
          (object) =>
            object.id === selectedId || object.clientId === selectedId,
        ),
      ).toBe(expected);
    }

    const fetchedWithoutClientId = { ...persisted, clientId: undefined };
    const visibleAfterRefetch = visibleCanvasObjects([fetchedWithoutClientId], {
      [selectedId]: { object: pending, persistedId: persisted.id },
    });
    expect(visibleAfterRefetch).toHaveLength(1);
    expect(visibleAfterRefetch[0]).toMatchObject({
      id: persisted.id,
      clientId: selectedId,
    });
  });
});
