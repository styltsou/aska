import { describe, expect, it } from "vitest";

import {
  KEYBINDINGS,
  matchesKeybinding,
  OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT,
  PEEK_NOTE_SHORTCUT,
} from "./keybindings";

function event({
  code,
  key,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
  shiftKey = false,
}: {
  code: string;
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}) {
  return { code, key, altKey, ctrlKey, metaKey, shiftKey } as KeyboardEvent;
}

describe("matchesKeybinding", () => {
  it("matches extra modifiers only when the binding specifies them", () => {
    const scratchpad = KEYBINDINGS.find(
      (kb) => kb.command === "open-scratchpad",
    );
    expect(scratchpad).toBeDefined();
    expect(scratchpad).not.toBeUndefined();

    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", shiftKey: true }),
        scratchpad!,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", shiftKey: true, altKey: true }),
        scratchpad!,
      ),
    ).toBe(false);
  });

  it("PEEK_NOTE_SHORTCUT matches only Alt+Shift+P", () => {
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", altKey: true, shiftKey: true }),
        PEEK_NOTE_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({
          code: "KeyP",
          key: "p",
          metaKey: true,
          altKey: true,
          shiftKey: true,
        }),
        PEEK_NOTE_SHORTCUT,
      ),
    ).toBe(false);
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", altKey: true }),
        PEEK_NOTE_SHORTCUT,
      ),
    ).toBe(false);
    expect(
      matchesKeybinding(event({ code: "KeyO", key: "o" }), PEEK_NOTE_SHORTCUT),
    ).toBe(false);
  });

  it("OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT matches only Alt+Shift+O", () => {
    expect(
      matchesKeybinding(
        event({ code: "KeyO", key: "o", altKey: true, shiftKey: true }),
        OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p" }),
        OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT,
      ),
    ).toBe(false);
  });

  it("accepts Ctrl or Meta for metaOrCtrl bindings without extra modifiers", () => {
    const palette = KEYBINDINGS.find(
      (kb) => kb.command === "toggle-command-palette",
    );
    expect(palette).toBeDefined();
    expect(palette).not.toBeUndefined();

    expect(
      matchesKeybinding(
        event({ code: "KeyK", key: "k", ctrlKey: true }),
        palette!,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "KeyK", key: "k", metaKey: true }),
        palette!,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "KeyK", key: "k", ctrlKey: true, altKey: true }),
        palette!,
      ),
    ).toBe(false);
  });
});
