import { describe, expect, it } from "vitest";

import type { CollectionNode } from "@/api/collection";
import { isGridRenderableNode } from "./collection-grid-node";

describe("isGridRenderableNode", () => {
  it("keeps canvas-only annotations and relationships out of the grid", () => {
    expect(
      isGridRenderableNode({ type: "arrow" } as unknown as CollectionNode),
    ).toBe(false);
    expect(
      isGridRenderableNode({ type: "text" } as unknown as CollectionNode),
    ).toBe(false);
    expect(
      isGridRenderableNode({ type: "raw-text" } as unknown as CollectionNode),
    ).toBe(false);
  });

  it("keeps collection assets in the grid", () => {
    expect(
      isGridRenderableNode({ type: "image" } as unknown as CollectionNode),
    ).toBe(true);
  });
});
