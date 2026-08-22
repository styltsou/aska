import { describe, expect, it } from "vitest";

import {
  mergePersistedAppStore,
  migratePersistedAppStore,
} from "./persisted-store-migration";

describe("persisted app store migration", () => {
  it("adds the creation-toolbar preference to existing stored state", () => {
    expect(
      migratePersistedAppStore({
        boardLocks: { "studio:ideas": true },
        workspaceAlignmentGuides: { studio: false },
      }),
    ).toMatchObject({
      boardLocks: { "studio:ideas": true },
      workspaceAlignmentGuides: { studio: false },
      workspaceBoardActionRails: {},
    });
  });

  it("replaces malformed toolbar preferences without discarding valid state", () => {
    expect(
      mergePersistedAppStore(
        { workspaceBoardActionRails: null, open: false },
        {
          open: true,
          workspaceBoardActionRails: { studio: true },
        },
      ),
    ).toEqual({
      open: false,
      workspaceBoardActionRails: {},
    });
  });
});
