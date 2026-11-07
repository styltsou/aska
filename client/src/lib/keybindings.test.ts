import { afterEach, describe, expect, it, vi } from "vitest";

import {
  KEYBINDINGS,
  matchesKeybinding,
  OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT,
  PEEK_ASSET_SHORTCUT,
  TOGGLE_ASSET_FULLSCREEN_SHORTCUT,
} from "./keybindings";

afterEach(() => vi.unstubAllGlobals());

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

  it("uses Alt+Shift+P for peek and Ctrl+Enter for fullscreen on Windows", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", altKey: true, shiftKey: true }),
        PEEK_ASSET_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "Enter", key: "Enter", ctrlKey: true }),
        TOGGLE_ASSET_FULLSCREEN_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", ctrlKey: true, shiftKey: true }),
        PEEK_ASSET_SHORTCUT,
      ),
    ).toBe(false);
    expect(
      matchesKeybinding(event({ code: "KeyO", key: "o" }), PEEK_ASSET_SHORTCUT),
    ).toBe(false);
  });

  it("uses Alt+Shift+P for peek and Command+Enter for fullscreen on macOS", () => {
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", altKey: true, shiftKey: true }),
        PEEK_ASSET_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "Enter", key: "Enter", metaKey: true }),
        TOGGLE_ASSET_FULLSCREEN_SHORTCUT,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "Enter", key: "Enter", ctrlKey: true }),
        TOGGLE_ASSET_FULLSCREEN_SHORTCUT,
      ),
    ).toBe(false);
    expect(
      matchesKeybinding(
        event({ code: "Enter", key: "Enter", metaKey: true, shiftKey: true }),
        TOGGLE_ASSET_FULLSCREEN_SHORTCUT,
      ),
    ).toBe(false);
    expect(
      matchesKeybinding(
        event({ code: "KeyP", key: "p", metaKey: true, shiftKey: true }),
        PEEK_ASSET_SHORTCUT,
      ),
    ).toBe(false);
  });

  it("keeps Alt+Shift+O as a promotion alias", () => {
    expect(
      matchesKeybinding(
        event({ code: "KeyO", key: "o", altKey: true, shiftKey: true }),
        OPEN_NOTE_IN_MAIN_EDITOR_SHORTCUT,
      ),
    ).toBe(true);
  });

  it("toggles the sidebar with the platform modifier and slash", () => {
    vi.stubGlobal("navigator", { platform: "Win32" });
    const sidebar = KEYBINDINGS.find((kb) => kb.command === "toggle-sidebar")!;
    expect(
      matchesKeybinding(
        event({ code: "Slash", key: "/", ctrlKey: true }),
        sidebar,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(
        event({ code: "KeyB", key: "b", ctrlKey: true }),
        sidebar,
      ),
    ).toBe(false);
    vi.stubGlobal("navigator", { platform: "MacIntel" });
    expect(
      matchesKeybinding(
        event({ code: "Slash", key: "/", metaKey: true }),
        sidebar,
      ),
    ).toBe(true);
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

  it("new-color matches only Shift+C", () => {
    const newColor = KEYBINDINGS.find((kb) => kb.command === "new-color");
    expect(newColor).toBeDefined();
    expect(newColor).not.toBeUndefined();

    expect(
      matchesKeybinding(
        event({ code: "KeyC", key: "c", shiftKey: true }),
        newColor!,
      ),
    ).toBe(true);
    expect(
      matchesKeybinding(event({ code: "KeyC", key: "c" }), newColor!),
    ).toBe(false);
    expect(
      matchesKeybinding(
        event({ code: "KeyC", key: "c", ctrlKey: true }),
        newColor!,
      ),
    ).toBe(false);
  });
});
