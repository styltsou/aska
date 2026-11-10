import { describe, expect, it } from "vitest";

import { getSidebarCollectionLocation } from "./sidebar-collection-navigation";

describe("sidebar collection navigation", () => {
  it("targets the current nested folder level", () => {
    expect(
      getSidebarCollectionLocation(
        "/personal/collections/reference/type/serif",
      ),
    ).toEqual({
      workspaceSlug: "personal",
      collectionSlug: "reference",
      folderSegments: ["type", "serif"],
      folderPath: "type/serif",
    });
  });
});
