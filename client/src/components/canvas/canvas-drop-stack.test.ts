import { describe, expect, it } from "vitest";

import { makeCanvasDropStackStyles } from "./canvas-drop-stack";

describe("canvas drop stack", () => {
  it("keeps the grabbed card fixed and stacks the other cards around it", () => {
    const styles = makeCanvasDropStackStyles(
      "note-2",
      new Map([
        ["image-1", { x: 400, y: 40 }],
        ["note-2", { x: 100, y: 100 }],
        ["folder-3", { x: -80, y: 250 }],
      ]),
    );

    expect(styles.get("note-2")).toMatchObject({
      translateX: 0,
      translateY: 0,
      rotation: 0,
      scale: 0.72,
    });
    expect(styles.get("image-1")).toMatchObject({
      translateX: -315,
      translateY: 106,
      rotation: -3.5,
      scale: 0.72,
    });
    expect(styles.get("folder-3")).toMatchObject({
      translateX: 203,
      translateY: -68,
      rotation: 5,
      scale: 0.72,
    });
    expect(styles.get("note-2")!.stackOrder).toBeGreaterThan(
      styles.get("image-1")!.stackOrder,
    );
    expect(styles.get("note-2")!.stackOrder).toBeGreaterThan(
      styles.get("folder-3")!.stackOrder,
    );
  });

  it("uses one scale while increasing each trailing card's visible peek", () => {
    const origins = new Map(
      Array.from({ length: 12 }, (_, index) => [
        `note-${index + 1}`,
        { x: index * 100, y: index * 50 },
      ]),
    );
    const styles = makeCanvasDropStackStyles("note-1", origins);
    let previousStackedY = 0;

    for (const [nodeId, style] of styles) {
      if (nodeId === "note-1") continue;
      const origin = origins.get(nodeId)!;
      const stackedX = origin.x + style.translateX;
      const stackedY = origin.y + style.translateY;

      expect(Math.abs(stackedX)).toBeLessThanOrEqual(23);
      expect(stackedY).toBeGreaterThanOrEqual(16);
      expect(stackedY).toBeLessThanOrEqual(82);
      expect(Math.abs(style.rotation)).toBeLessThanOrEqual(5);
      expect(style.scale).toBe(0.72);
      expect(style.delayMs).toBeLessThanOrEqual(32);
      expect(stackedY).toBeGreaterThan(previousStackedY);

      previousStackedY = stackedY;
    }
  });

  it("compresses a single grabbed card over a folder target", () => {
    const styles = makeCanvasDropStackStyles(
      "note-1",
      new Map([["note-1", { x: 0, y: 0 }]]),
    );

    expect(styles.get("note-1")).toMatchObject({
      translateX: 0,
      translateY: 0,
      rotation: 0,
      scale: 0.72,
    });
  });

  it("returns no stack for a missing grabbed card", () => {
    expect(
      makeCanvasDropStackStyles(
        "note-9",
        new Map([
          ["note-1", { x: 0, y: 0 }],
          ["note-2", { x: 100, y: 0 }],
        ]),
      ),
    ).toEqual(new Map());
  });
});
