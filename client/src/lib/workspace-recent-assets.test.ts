import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getRecentWorkspaceAssetIds,
  recordRecentWorkspaceAsset,
} from "./workspace-recent-assets";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("workspace recent assets", () => {
  it("keeps the most recently opened assets first without duplicates", () => {
    recordRecentWorkspaceAsset("design", "note-1");
    recordRecentWorkspaceAsset("design", "image-2");
    recordRecentWorkspaceAsset("design", "note-1");

    expect(getRecentWorkspaceAssetIds("design")).toEqual(["note-1", "image-2"]);
  });

  it("ignores malformed stored values and asset identifiers", () => {
    storage.set("aska.workspace-recent-assets:design", '["folder-1", 3]');

    expect(getRecentWorkspaceAssetIds("design")).toEqual([]);
    recordRecentWorkspaceAsset("design", "folder-1");
    expect(getRecentWorkspaceAssetIds("design")).toEqual([]);
  });
});
