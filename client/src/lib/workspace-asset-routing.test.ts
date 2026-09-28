import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/work"] }),
});

describe("workspace asset routes", () => {
  it.each([
    ["/work/asset/note-1", "/$workspaceSlug/asset/$assetId"],
    ["/work/inbox/asset/image-2", "/$workspaceSlug/inbox/$"],
    [
      "/work/collections/ideas/nested/asset/color-3",
      "/$workspaceSlug/collections/$",
    ],
  ])("matches %s", (pathname, routeId) => {
    expect(router.matchRoutes(pathname).at(-1)?.routeId).toBe(routeId);
  });
});
