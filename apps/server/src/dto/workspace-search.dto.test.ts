import { describe, expect, it } from "vitest";

import { WorkspaceSearchQuerySchema } from "./workspace-search.dto";

describe("WorkspaceSearchQuerySchema", () => {
  it("supplies safe defaults", () => {
    expect(WorkspaceSearchQuerySchema.parse({})).toEqual({
      q: "",
      limit: 20,
      recent: [],
    });
  });

  it("coerces a bounded result limit", () => {
    expect(
      WorkspaceSearchQuerySchema.parse({ q: "palette", limit: "8" }),
    ).toEqual({ q: "palette", limit: 8, recent: [] });
    expect(WorkspaceSearchQuerySchema.safeParse({ limit: 0 }).success).toBe(
      false,
    );
    expect(WorkspaceSearchQuerySchema.safeParse({ limit: 21 }).success).toBe(
      false,
    );
  });

  it("rejects oversized queries", () => {
    expect(
      WorkspaceSearchQuerySchema.safeParse({ q: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("accepts a small de-duplicated list of recent assets", () => {
    expect(
      WorkspaceSearchQuerySchema.parse({
        recent: "note-1,image-2,note-1",
      }).recent,
    ).toEqual(["note-1", "image-2"]);
    expect(
      WorkspaceSearchQuerySchema.safeParse({ recent: "folder-1" }).success,
    ).toBe(false);
  });
});
