import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";

import {
  createFilterBarSlice,
  MAX_COLOR_FILTERS,
  type FilterBarSlice,
} from "./filter-bar-slice";

function createTestStore() {
  return createStore<FilterBarSlice>()(createFilterBarSlice);
}

describe("color filter selection", () => {
  it("keeps the first five colors while allowing an active color to be removed", () => {
    const store = createTestStore();
    const scope = "inbox:personal";
    const colors = ["#111111", "#222222", "#333333", "#444444", "#555555"];

    for (const color of colors) {
      store.getState().toggleColor(scope, color);
    }
    store.getState().toggleColor(scope, "#666666");

    expect(store.getState().filterBars[scope]?.selectedColors).toEqual(colors);

    store.getState().toggleColor(scope, "#333333");
    store.getState().toggleColor(scope, "#666666");

    expect(store.getState().filterBars[scope]?.selectedColors).toEqual([
      "#111111",
      "#222222",
      "#444444",
      "#555555",
      "#666666",
    ]);
    expect(store.getState().filterBars[scope]?.selectedColors).toHaveLength(
      MAX_COLOR_FILTERS,
    );
  });

  it("persists type filter choices independently", () => {
    const store = createTestStore();
    const scope = "collection:personal/reference";

    store.getState().toggleAssetType(scope, "image");
    store.getState().toggleAssetType(scope, "note");

    expect(store.getState().filterBars[scope]).toMatchObject({
      selectedAssetTypes: ["image", "note"],
    });

    store.getState().clearAssetTypes(scope);

    expect(store.getState().filterBars[scope]).toMatchObject({
      selectedAssetTypes: [],
    });
  });
});
