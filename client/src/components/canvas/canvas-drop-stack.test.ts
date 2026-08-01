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
      scale: 1,
    });
    expect(styles.get("image-1")).toMatchObject({
      translateX: -305,
      translateY: 63,
      rotation: -2.75,
    });
    expect(styles.get("folder-3")).toMatchObject({
      translateX: 185,
      translateY: -144,
      rotation: 2.75,
    });
    expect(styles.get("note-2")!.stackOrder).toBeGreaterThan(
      styles.get("image-1")!.stackOrder,
    );
    expect(styles.get("note-2")!.stackOrder).toBeGreaterThan(
      styles.get("folder-3")!.stackOrder,
    );
  });

  it("caps fan distance, rotation, scale, and delay for large selections", () => {
    const origins = new Map(
      Array.from({ length: 12 }, (_, index) => [
        `note-${index + 1}`,
        { x: index * 100, y: index * 50 },
      ]),
    );
    const styles = makeCanvasDropStackStyles("note-1", origins);

    for (const [nodeId, style] of styles) {
      if (nodeId === "note-1") continue;
      const origin = origins.get(nodeId)!;
      const stackedX = origin.x + style.translateX;
      const stackedY = origin.y + style.translateY;

      expect(Math.abs(stackedX)).toBeLessThanOrEqual(9);
      expect(stackedY).toBeGreaterThanOrEqual(3);
      expect(stackedY).toBeLessThanOrEqual(12);
      expect(Math.abs(style.rotation)).toBeLessThanOrEqual(4);
      expect(style.scale).toBeGreaterThanOrEqual(0.97);
      expect(style.delayMs).toBeLessThanOrEqual(32);
    }
  });

  it("returns no stack for a single card or a missing grabbed card", () => {
    expect(
      makeCanvasDropStackStyles(
        "note-1",
        new Map([["note-1", { x: 0, y: 0 }]]),
      ),
    ).toEqual(new Map());
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
