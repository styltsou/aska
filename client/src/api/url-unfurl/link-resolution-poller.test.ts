import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { collectionQueryKeys } from "@/api/collection/query-keys";
import type {
  CollectionContentsResponse,
  CollectionLinkNode,
} from "@/api/collection/types";
import {
  patchLinkInCaches,
  trackLinkResolution,
} from "./link-resolution-poller";
import { useLinkResolutionTracker } from "./link-resolution-tracker";

const workspaceSlug = "studio";

beforeEach(() => {
  useLinkResolutionTracker.setState({ pendingByWorkspace: {} });
});

describe("link resolution tracker", () => {
  it("tracks only active link work", () => {
    trackLinkResolution(workspaceSlug, link({ resolutionStatus: "queued" }));
    trackLinkResolution(workspaceSlug, link({ resolutionStatus: "ready" }));

    expect(useLinkResolutionTracker.getState().pendingByWorkspace).toEqual({
      [workspaceSlug]: ["link-42"],
    });
  });

  it("patches matching cards without overwriting local placement or notes", () => {
    const queryClient = new QueryClient();
    const key = collectionQueryKeys.contents(workspaceSlug, "ideas");
    const initial = contents(
      link({ note: "Keep this", position: { x: 4, y: 8 } }),
    );
    queryClient.setQueryData(key, initial);

    patchLinkInCaches(
      queryClient,
      workspaceSlug,
      link({
        title: "Resolved title",
        description: "Resolved description",
        resolutionStatus: "ready",
        previewImage: {
          url: "https://media.test/preview.webp",
          width: 960,
          height: 480,
        },
      }),
    );

    expect(
      queryClient.getQueryData<CollectionContentsResponse>(key)?.nodes[0],
    ).toMatchObject({
      id: "link-42",
      title: "Resolved title",
      description: "Resolved description",
      note: "Keep this",
      position: { x: 4, y: 8 },
      previewImage: { url: "https://media.test/preview.webp" },
    });
  });
});

function contents(node: CollectionLinkNode): CollectionContentsResponse {
  return {
    collection: { id: 1, name: "Ideas", slug: "ideas" },
    breadcrumbs: [],
    nodes: [node],
    canvasObjects: [],
  };
}

function link(overrides: Partial<CollectionLinkNode> = {}): CollectionLinkNode {
  return {
    id: "link-42",
    type: "link",
    originalUrl: "https://example.com/article",
    canonicalUrl: null,
    hostname: "example.com",
    title: "example.com",
    description: null,
    note: null,
    siteName: null,
    resourceKind: "web_page",
    resolutionStatus: "resolving",
    failureCategory: null,
    resolvedAt: null,
    staleAt: null,
    previewImage: null,
    favicon: null,
    video: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    position: null,
    ...overrides,
  };
}
