import { describe, expect, it } from "vitest";
import { nextOverlayTrail } from "./workspace-overlay-history";

const board = "/work/collections/ideas";
const first = `${board}/asset/note-1`;
const second = `${board}/asset/note-2`;

describe("overlay history shortcuts", () => {
  it("counts peek entries between main views", () => {
    const opened = nextOverlayTrail(board, first, undefined, false);
    const peeked = nextOverlayTrail(first, first, opened, false);
    const promoted = nextOverlayTrail(first, second, peeked, false);
    const changedPeek = nextOverlayTrail(second, second, promoted, false);
    expect(changedPeek).toEqual({
      boardPathname: board,
      boardDistance: 4,
      previousMainDistance: 2,
    });
  });

  it("keeps shortcut offsets when replacing a view or swapping main", () => {
    const opened = nextOverlayTrail(board, first, undefined, false);
    expect(nextOverlayTrail(first, second, opened, true)).toEqual(opened);
  });

  it("does not invent a board anchor for a direct asset link", () => {
    expect(nextOverlayTrail(first, second, undefined, false)).toEqual({
      boardPathname: board,
      boardDistance: undefined,
      directDistance: 1,
      previousMainDistance: 1,
    });
  });

  it("counts back to the first direct asset when no board entry exists", () => {
    const peeked = nextOverlayTrail(first, first, undefined, false);
    const nextMain = nextOverlayTrail(first, second, peeked, false);
    expect(nextMain?.directDistance).toBe(2);
    expect(nextMain?.boardDistance).toBeUndefined();
  });
});
