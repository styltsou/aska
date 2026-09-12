import { describe, expect, it } from "vitest";

import { parseWorkspaceAssetId } from "./workspace-asset-url";

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
