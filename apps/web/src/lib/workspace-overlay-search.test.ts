import { describe, expect, it } from "vitest";
import {
  mergeWorkspaceOverlaySearch,
  openMainAssetSearchPatch,
} from "./workspace-overlay-search";

describe("workspace overlay search transitions", () => {
  it("preserves an existing peek when opening a different main asset", () => {
    const current = {
      peek: "color-4",
      peekScope: "collection:ideas/references",
      peekDescendants: true,
    } as const;

    expect(
      mergeWorkspaceOverlaySearch(
        current,
        openMainAssetSearchPatch({
          currentPeekId: current.peek,
          nextAssetId: "note-2",
          fullscreen: false,
        }),
      ),
    ).toEqual({
      ...current,
      asset: undefined,
      view: undefined,
    });
  });

  it("removes the peek when that same asset is promoted to main", () => {
    expect(
      mergeWorkspaceOverlaySearch(
        { peek: "note-2", settings: true },
        openMainAssetSearchPatch({
          currentPeekId: "note-2",
          nextAssetId: "note-2",
          fullscreen: false,
        }),
      ),
    ).toEqual({
      asset: undefined,
      peek: undefined,
      peekScope: undefined,
      peekDescendants: undefined,
      settings: true,
      view: undefined,
    });
  });

  it("opens a promoted image in full view and clears its peek", () => {
    expect(
      mergeWorkspaceOverlaySearch(
        { peek: "image-1", peekScope: "collection:inspiration" },
        openMainAssetSearchPatch({
          currentPeekId: "image-1",
          nextAssetId: "image-1",
          fullscreen: true,
        }),
      ),
    ).toEqual({
      asset: undefined,
      peek: undefined,
      peekScope: undefined,
      peekDescendants: undefined,
      view: "full",
    });
  });

  it("makes the previous main the peek when swapping", () => {
    expect(
      mergeWorkspaceOverlaySearch(
        {
          peek: "color-4",
          peekScope: "collection:ideas",
          peekDescendants: true,
        },
        openMainAssetSearchPatch({
          currentPeekId: "color-4",
          nextAssetId: "note-2",
          peekAfter: "note-1",
          fullscreen: false,
        }),
      ),
    ).toEqual({
      asset: undefined,
      peek: "note-1",
      peekScope: undefined,
      peekDescendants: undefined,
      view: undefined,
    });
  });

  it("preserves unrelated URL state while changing presentation", () => {
    expect(
      mergeWorkspaceOverlaySearch(
        { peek: "note-1", settings: true },
        openMainAssetSearchPatch({
          currentPeekId: "note-1",
          nextAssetId: "link-3",
          fullscreen: true,
        }),
      ),
    ).toEqual({
      asset: undefined,
      peek: "note-1",
      settings: true,
      view: "full",
    });
  });
});
