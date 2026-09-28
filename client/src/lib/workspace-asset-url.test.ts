import { describe, expect, it } from "vitest";

import {
  parseWorkspaceAssetId,
  parseWorkspaceAssetPath,
  workspaceAssetPath,
} from "./workspace-asset-url";

describe("parseWorkspaceAssetId", () => {
  it.each(["image-1", "note-24", "link-8", "color-300"])(
    "accepts %s",
    (assetId) => {
      expect(parseWorkspaceAssetId(assetId)).toBe(assetId);
    },
  );

  it.each([undefined, null, 12, "folder-1", "note-x", "note-1-more"])(
    "rejects %s",
    (assetId) => {
      expect(parseWorkspaceAssetId(assetId)).toBeUndefined();
    },
  );
});

describe("workspace asset paths", () => {
  it("uses the asset route segment", () => {
    expect(workspaceAssetPath("/work/collections/ideas", "note-1")).toBe(
      "/work/collections/ideas/asset/note-1",
    );
  });

  it.each([
    ["/work", "note-1"],
    ["/work/inbox", "image-2"],
    ["/work/collections/ideas/nested", "color-3"],
  ])("round-trips %s with %s", (boardPathname, assetId) => {
    expect(
      parseWorkspaceAssetPath(workspaceAssetPath(boardPathname, assetId)),
    ).toEqual({ boardPathname, assetId });
  });

  it("does not treat a malformed suffix as an asset", () => {
    expect(
      parseWorkspaceAssetPath("/work/collections/ideas/asset/note-x"),
    ).toEqual({ boardPathname: "/work/collections/ideas/asset/note-x" });
  });
});
