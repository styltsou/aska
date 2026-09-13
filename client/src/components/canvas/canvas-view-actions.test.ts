import { describe, expect, it, vi } from "vitest";

import {
  getCanvasViewShortcutAction,
  runCanvasViewAction,
  setCanvasViewActions,
} from "./canvas-view-actions";

const event = (
  key: string,
  modifiers: Partial<
    Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">
  > = {},
) =>
  ({
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  }) as KeyboardEvent;

describe("canvas view actions", () => {
  it("dispatches registered actions and safely ignores unavailable boards", () => {
    const zoomIn = vi.fn();
    const setZoom = vi.fn();
    const clear = setCanvasViewActions("active-board", {
      "zoom-in": zoomIn,
      "zoom-out": vi.fn(),
      "set-zoom": setZoom,
      "fit-view": vi.fn(),
    });

    expect(runCanvasViewAction("active-board", "zoom-in")).toBe(true);
    expect(zoomIn).toHaveBeenCalledOnce();
    expect(runCanvasViewAction("active-board", "set-zoom", 1.25)).toBe(true);
    expect(setZoom).toHaveBeenCalledWith(1.25);
    expect(runCanvasViewAction("missing-board", "zoom-in")).toBe(false);

    clear();
  });

  it("does not let an older cleanup remove a newer registration", () => {
    const oldZoomIn = vi.fn();
    const newZoomIn = vi.fn();
    const clearOld = setCanvasViewActions("replaced-board", {
      "zoom-in": oldZoomIn,
      "zoom-out": vi.fn(),
      "set-zoom": vi.fn(),
      "fit-view": vi.fn(),
    });
    const clearNew = setCanvasViewActions("replaced-board", {
      "zoom-in": newZoomIn,
      "zoom-out": vi.fn(),
      "set-zoom": vi.fn(),
      "fit-view": vi.fn(),
    });

    clearOld();
    runCanvasViewAction("replaced-board", "zoom-in");
    expect(oldZoomIn).not.toHaveBeenCalled();
    expect(newZoomIn).toHaveBeenCalledOnce();

    clearNew();
  });

  it("maps only unmodified canvas navigation shortcuts", () => {
    expect(getCanvasViewShortcutAction(event("+"))).toBe("zoom-in");
    expect(getCanvasViewShortcutAction(event("-"))).toBe("zoom-out");
    expect(getCanvasViewShortcutAction(event("1"))).toBe("fit-view");
    expect(getCanvasViewShortcutAction(event("1", { shiftKey: true }))).toBe(
      undefined,
    );
    expect(getCanvasViewShortcutAction(event("+", { metaKey: true }))).toBe(
      undefined,
    );
  });
});
