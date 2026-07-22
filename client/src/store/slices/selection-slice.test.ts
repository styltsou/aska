import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";

import { createSelectionSlice, type SelectionSlice } from "./selection-slice";

function createTestStore() {
  return createStore<SelectionSlice>()(createSelectionSlice);
}

describe("selection slice", () => {
  it("resets only when activating a different scope", () => {
    const store = createTestStore();
    store.getState().replaceSelection("inbox:design", ["image-1"]);
    store.getState().activateSelectionScope("inbox:design");
    expect(store.getState().selection).toEqual({
      scopeKey: "inbox:design",
      nodeIds: ["image-1"],
    });

    store.getState().activateSelectionScope("collection:design:ideas");
    expect(store.getState().selection).toEqual({
      scopeKey: "collection:design:ideas",
      nodeIds: [],
    });
  });

  it("keeps IDs unique and toggles one ID at a time", () => {
    const store = createTestStore();
    store
      .getState()
      .replaceSelection("inbox:design", ["image-1", "note-2", "image-1"]);
    store.getState().toggleSelectedNode("inbox:design", "note-2");
    store.getState().toggleSelectedNode("inbox:design", "folder-3");

    expect(store.getState().selection.nodeIds).toEqual(["image-1", "folder-3"]);
  });

  it("does not clear a newer surface from late cleanup", () => {
    const store = createTestStore();
    store.getState().replaceSelection("inbox:design", ["image-1"]);
    store.getState().replaceSelection("collection:design:ideas", ["note-2"]);
    store.getState().clearSelection("inbox:design");

    expect(store.getState().selection).toEqual({
      scopeKey: "collection:design:ideas",
      nodeIds: ["note-2"],
    });
  });
});
