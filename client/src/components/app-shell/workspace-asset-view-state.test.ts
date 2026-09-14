import { describe, expect, it } from "vitest";

import {
  completeAssetPresentationClose,
  openAssetPresentation,
  requestAssetPresentationClose,
  syncAssetPresentationToUrl,
} from "./workspace-asset-view-state";

describe("workspace asset presentation", () => {
  it("opens immediately while the URL navigation is pending", () => {
    expect(openAssetPresentation("image-2")).toEqual({
      assetId: "image-2",
      open: true,
      urlStatus: "pending",
    });
  });

  it("acknowledges the matching URL without closing the presentation", () => {
    const pending = openAssetPresentation("image-2");

    expect(syncAssetPresentationToUrl(pending, "image-2")).toEqual({
      assetId: "image-2",
      open: true,
      urlStatus: "committed",
    });
  });

  it("switches directly to a browser-history asset", () => {
    const current = openAssetPresentation("image-2", "image-2");

    expect(syncAssetPresentationToUrl(current, "color-4")).toEqual({
      assetId: "color-4",
      open: true,
      urlStatus: "committed",
    });
  });

  it("retains an internally closed presentation until URL cleanup", () => {
    const current = openAssetPresentation("note-3", "note-3");
    const closing = requestAssetPresentationClose(current);
    const completed = completeAssetPresentationClose(closing);

    expect(completed.shouldCleanupUrl).toBe(true);
    expect(completed.presentation).toMatchObject({
      assetId: "note-3",
      open: false,
      closeOrigin: "waiting-for-url",
    });
    expect(syncAssetPresentationToUrl(completed.presentation)).toBeNull();
  });

  it("animates an external URL close without another history mutation", () => {
    const current = openAssetPresentation("image-8", "image-8");
    const closing = syncAssetPresentationToUrl(current);

    expect(closing).toMatchObject({
      open: false,
      closeOrigin: "external",
    });
    expect(completeAssetPresentationClose(closing)).toEqual({
      presentation: null,
      shouldCleanupUrl: false,
    });
  });

  it("does not mistake the pre-commit URL for an external navigation", () => {
    const pending = openAssetPresentation("image-9", "image-8");

    expect(syncAssetPresentationToUrl(pending)).toBe(pending);
  });
});
