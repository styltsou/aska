import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";

import {
  createCollectionViewSlice,
  getCollectionViewScope,
} from "./collection-view-slice";
import type { CollectionViewSlice } from "./collection-view-slice";

describe("collection view slice", () => {
  it("shares a view across every folder in the same collection", () => {
    const store = createStore<CollectionViewSlice>()(createCollectionViewSlice);
    const scope = getCollectionViewScope("studio", "references");

    store.getState().setCollectionView(scope, "grid");

    expect(store.getState().collectionViews[scope]).toBe("grid");
    expect(getCollectionViewScope("studio", "references")).toBe(scope);
    expect(getCollectionViewScope("studio", "archive")).not.toBe(scope);
  });
});
