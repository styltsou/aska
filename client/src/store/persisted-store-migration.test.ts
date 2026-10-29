import { describe, expect, it } from "vitest";
import { migratePersistedAppStore } from "./persisted-store-migration";

describe("persisted app store migration", () => {
  it("preserves an enabled dock and migrates current tab view choices", () => {
    expect(
      migratePersistedAppStore(
        {
          workspaceBoardActionRails: { studio: false, other: true },
          open: false,
        },
        { "studio:references": "grid" },
      ),
    ).toEqual({
      open: false,
      boardActionRailVisible: true,
      collectionViews: { "studio:references": "grid" },
    });
  });

  it("keeps newer preferences and handles malformed legacy values", () => {
    expect(
      migratePersistedAppStore(
        {
          workspaceBoardActionRails: null,
          boardActionRailVisible: false,
          collectionViews: { "studio:ideas": "canvas" },
        },
        { "studio:ideas": "grid" },
      ),
    ).toEqual({
      boardActionRailVisible: false,
      collectionViews: { "studio:ideas": "canvas" },
    });
    expect(
      migratePersistedAppStore({ workspaceBoardActionRails: null }),
    ).toEqual({ boardActionRailVisible: false, collectionViews: {} });
  });
});
