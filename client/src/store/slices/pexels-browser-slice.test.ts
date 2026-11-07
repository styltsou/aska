import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { describe, expect, it } from "vitest";
import type { PexelsPhoto } from "@/api/pexels";
import type { SessionStore } from "@/store";
import { createFilterBarSlice } from "./filter-bar-slice";
import { createPexelsBrowserScopeSlice } from "./pexels-browser-slice";

describe("Pexels selection", () => {
  it("removes imported photos without clearing other selections or collections", () => {
    const store = createStore<SessionStore>()(
      immer((...args) => ({
        ...createFilterBarSlice(...args),
        ...createPexelsBrowserScopeSlice(...args),
      })),
    );
    const first = { id: "1" } as PexelsPhoto;
    const second = { id: "2" } as PexelsPhoto;
    store.getState().setPexelsBrowserSelected("workspace/a", [first, second]);
    store.getState().setPexelsBrowserSelected("workspace/b", [first]);
    store.getState().removePexelsBrowserSelected("workspace/a", ["1"]);
    expect(
      store.getState().pexelsBrowserByScope["workspace/a"]?.selected,
    ).toEqual([second]);
    expect(
      store.getState().pexelsBrowserByScope["workspace/b"]?.selected,
    ).toEqual([first]);
  });
});
