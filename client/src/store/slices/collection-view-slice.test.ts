import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { describe, expect, it } from "vitest";

import {
  createCollectionViewSlice,
  getCollectionViewScope,
} from "./collection-view-slice";
import { createFilterBarSlice } from "./filter-bar-slice";
import { createPexelsBrowserScopeSlice } from "./pexels-browser-slice";
import type { SessionStore } from "@/store";

describe("collection view slice", () => {
  it("shares a view across every folder in the same collection", () => {
    const store = createStore<SessionStore>()(
      immer((...args) => ({
        ...createCollectionViewSlice(...args),
        ...createFilterBarSlice(...args),
        ...createPexelsBrowserScopeSlice(...args),
      })),
    );
    const scope = getCollectionViewScope("studio", "references");

    store.getState().setCollectionView(scope, "browse");

    expect(store.getState().collectionViews[scope]).toBe("browse");
    expect(getCollectionViewScope("studio", "references")).toBe(scope);
    expect(getCollectionViewScope("studio", "archive")).not.toBe(scope);
  });
});
