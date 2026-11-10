import { describe, expect, it } from "vitest";

import { getSlashMenuScrollTop } from "./slash-menu-scroll";

const baseInput = {
  itemCount: 12,
  itemHeight: 32,
  clientHeight: 224,
  scrollHeight: 416,
};

describe("getSlashMenuScrollTop", () => {
  it("keeps downward navigation still until the active item reaches its anchor", () => {
    expect(
      getSlashMenuScrollTop({
        ...baseInput,
        direction: "down",
        selectedIndex: 4,
        itemTop: 128,
        scrollTop: 0,
      }),
    ).toBe(0);
  });

  it("pins downward navigation one row from the bottom", () => {
    expect(
      getSlashMenuScrollTop({
        ...baseInput,
        direction: "down",
        selectedIndex: 6,
        itemTop: 192,
        scrollTop: 0,
      }),
    ).toBe(32);
  });

  it("pins upward navigation one row from the top", () => {
    expect(
      getSlashMenuScrollTop({
        ...baseInput,
        direction: "up",
        selectedIndex: 4,
        itemTop: 128,
        scrollTop: 160,
      }),
    ).toBe(96);
  });

  it("reveals the full list at either end, including wrapped navigation", () => {
    expect(
      getSlashMenuScrollTop({
        ...baseInput,
        direction: "up",
        selectedIndex: 0,
        itemTop: 24,
        scrollTop: 120,
      }),
    ).toBe(0);
    expect(
      getSlashMenuScrollTop({
        ...baseInput,
        direction: "down",
        selectedIndex: 0,
        itemTop: 24,
        scrollTop: 120,
      }),
    ).toBe(0);
    expect(
      getSlashMenuScrollTop({
        ...baseInput,
        direction: "down",
        selectedIndex: 11,
        itemTop: 352,
        scrollTop: 96,
      }),
    ).toBe(192);
    expect(
      getSlashMenuScrollTop({
        ...baseInput,
        direction: "up",
        selectedIndex: 11,
        itemTop: 352,
        scrollTop: 96,
      }),
    ).toBe(192);
  });

  it("handles one-item and non-scrollable result sets", () => {
    expect(
      getSlashMenuScrollTop({
        direction: "down",
        selectedIndex: 0,
        itemCount: 1,
        itemTop: 24,
        itemHeight: 32,
        scrollTop: 12,
        clientHeight: 224,
        scrollHeight: 160,
      }),
    ).toBe(0);
  });
});
