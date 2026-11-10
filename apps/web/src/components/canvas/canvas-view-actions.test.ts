import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CanvasActionsProvider,
  useCanvasActions,
} from "./canvas-actions-context";
import { getCanvasViewShortcutAction } from "./canvas-view-actions";

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

describe("canvas view actions context", () => {
  it("requires the provider before exposing the shared handle ref", () => {
    const probe = createElement(() => {
      useCanvasActions();
      return null;
    });

    expect(() => renderToStaticMarkup(probe)).toThrow(/CanvasActionsProvider/);
  });

  it("exposes a shared handle ref to consumers inside the provider", () => {
    let captured: ReturnType<typeof useCanvasActions> | null = null;
    const probe = createElement(() => {
      captured = useCanvasActions();
      return null;
    });

    renderToStaticMarkup(createElement(CanvasActionsProvider, null, probe));

    expect(captured).not.toBeNull();
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
