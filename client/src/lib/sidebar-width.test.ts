import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clampSidebarWidth,
  getSidebarMaxWidth,
  readSidebarWidth,
  saveSidebarWidth,
} from "./sidebar-width";

afterEach(() => vi.unstubAllGlobals());

describe("sidebar width", () => {
  it("bounds dragging and preserves room for the canvas on smaller desktops", () => {
    expect(clampSidebarWidth(100)).toBe(224);
    expect(clampSidebarWidth(900)).toBe(384);
    expect(clampSidebarWidth(384, 800)).toBe(320);
    expect(getSidebarMaxWidth(1920)).toBe(384);
    expect(clampSidebarWidth(NaN)).toBe(240);
  });

  it("restores separate user preferences without shrinking the saved width for a narrow window", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    saveSidebarWidth("aska:sidebar-width:alice", 384);
    saveSidebarWidth("aska:sidebar-width:bob", 240);
    expect(readSidebarWidth("aska:sidebar-width:alice")).toBe(384);
    expect(
      clampSidebarWidth(readSidebarWidth("aska:sidebar-width:alice"), 800),
    ).toBe(320);
    expect(readSidebarWidth("aska:sidebar-width:alice")).toBe(384);
    expect(readSidebarWidth("aska:sidebar-width:bob")).toBe(240);
    expect(readSidebarWidth("aska:sidebar-width:charlie")).toBe(240);
    values.set("invalid", "bad data");
    expect(readSidebarWidth("invalid")).toBe(240);
  });

  it("continues working when browser storage is blocked", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("blocked");
      },
    });
    expect(readSidebarWidth("user")).toBe(240);
    expect(() => saveSidebarWidth("user", 320)).not.toThrow();
  });
});
