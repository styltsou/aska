import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import { collectionQueryKeys } from "@/api/collection/query-keys";
import type {
  CollectionContentsResponse,
  CollectionLinkNode,
  CollectionNode,
  CollectionsData,
  FolderChildPreview,
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

  it("keeps the direct YouTube thumbnail only until server media is terminal", () => {
    const queryClient = new QueryClient();
    const key = collectionQueryKeys.contents(workspaceSlug, "ideas");
    queryClient.setQueryData(
      key,
      contents(
        link({
          id: "link-youtube",
          title: "Browser title",
          resolutionStatus: "queued",
          previewImage: {
            url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            width: 480,
            height: 360,
          },
          optimisticYouTube: {
            videoId: "dQw4w9WgXcQ",
            channelName: "A channel",
            metadataStatus: "ready",
          },
        }),
      ),
    );

    patchLinkInCaches(
      queryClient,
      workspaceSlug,
      link({
        id: "link-youtube",
        resolutionStatus: "resolving",
        title: "youtu.be",
      }),
    );

    expect(
      queryClient.getQueryData<CollectionContentsResponse>(key)?.nodes[0],
    ).toMatchObject({
      title: "Browser title",
      previewImage: {
        url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
      optimisticYouTube: { metadataStatus: "ready" },
    });

    patchLinkInCaches(
      queryClient,
      workspaceSlug,
      link({
        id: "link-youtube",
        resolutionStatus: "resolving",
        resolvedAt: "2026-01-02T00:00:00.000Z",
        title: "Authoritative title",
        description: "Authoritative description",
      }),
    );

    expect(
      queryClient.getQueryData<CollectionContentsResponse>(key)?.nodes[0],
    ).toMatchObject({
      title: "Authoritative title",
      description: "Authoritative description",
    });

    patchLinkInCaches(
      queryClient,
      workspaceSlug,
      link({ id: "link-youtube", resolutionStatus: "partial" }),
    );

    const terminal =
      queryClient.getQueryData<CollectionContentsResponse>(key)?.nodes[0];
    expect(terminal).toMatchObject({ previewImage: null });
    expect(terminal).not.toHaveProperty("optimisticYouTube");
  });

  it("patches matching collection and folder card previews", () => {
    const queryClient = new QueryClient();
    const collectionsKey = collectionQueryKeys.collections(workspaceSlug);
    const folderKey = collectionQueryKeys.contents(
      workspaceSlug,
      "ideas",
      undefined,
      "folder",
    );
    const pendingPreview = linkPreview();
    const untouchedPreview: FolderChildPreview = {
      assetId: "note-7",
      type: "note",
      title: "Leave me alone",
      snippet: "Unchanged",
    };

    queryClient.setQueryData<CollectionsData>(collectionsKey, {
      collections: [
        {
          id: 1,
          name: "Ideas",
          slug: "ideas",
          description: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          assetCount: 2,
          previews: [pendingPreview, untouchedPreview],
        },
      ],
    });
    queryClient.setQueryData(
      folderKey,
      contents({
        id: "folder-8",
        type: "folder",
        name: "Reading",
        slug: "reading",
        count: 2,
        folderCount: 0,
        previews: [pendingPreview, untouchedPreview],
        createdAt: "2026-01-01T00:00:00.000Z",
        position: null,
      }),
    );

    patchLinkInCaches(queryClient, workspaceSlug, resolvedLink());

    const collectionPreview =
      queryClient.getQueryData<CollectionsData>(collectionsKey)?.collections[0]
        ?.previews[0];
    const folderPreview =
      queryClient.getQueryData<CollectionContentsResponse>(folderKey)?.nodes[0];

    expect(collectionPreview).toMatchObject(resolvedPreview());
    expect(folderPreview).toMatchObject({
      previews: [expect.objectContaining(resolvedPreview()), untouchedPreview],
    });
  });

  it("revalidates collection card and content caches only for terminal links", () => {
    const queryClient = new QueryClient();
    const collectionsKey = collectionQueryKeys.collections(workspaceSlug);
    const contentsKey = collectionQueryKeys.contents(workspaceSlug, "ideas");
    queryClient.setQueryData<CollectionsData>(collectionsKey, {
      collections: [],
    });
    queryClient.setQueryData(contentsKey, contents(link()));

    patchLinkInCaches(
      queryClient,
      workspaceSlug,
      link({ resolutionStatus: "resolving" }),
    );

    expect(queryClient.getQueryState(collectionsKey)?.isInvalidated).toBe(
      false,
    );
    expect(queryClient.getQueryState(contentsKey)?.isInvalidated).toBe(false);

    patchLinkInCaches(queryClient, workspaceSlug, resolvedLink());

    expect(queryClient.getQueryState(collectionsKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(contentsKey)?.isInvalidated).toBe(true);
  });
});

function contents(node: CollectionNode): CollectionContentsResponse {
  return {
    collection: { id: 1, name: "Ideas", slug: "ideas" },
    breadcrumbs: [],
    nodes: [node],
    canvasObjects: [],
  };
}

function linkPreview(): FolderChildPreview {
  return {
    assetId: "link-42",
    type: "link",
    hostname: "example.com",
    title: "example.com",
    description: null,
  };
}

function resolvedPreview() {
  return {
    assetId: "link-42",
    type: "link",
    hostname: "docs.example.com",
    title: "Resolved title",
    description: "Resolved description",
    url: "https://media.test/preview.webp",
    blurDataURL: "data:image/webp;base64,preview",
    favicon: "https://media.test/favicon.webp",
    videoId: "dQw4w9WgXcQ",
  };
}

function resolvedLink(): CollectionLinkNode {
  return link({
    hostname: "docs.example.com",
    title: "Resolved title",
    description: "Resolved description",
    resolutionStatus: "ready",
    previewImage: {
      url: "https://media.test/preview.webp",
      width: 960,
      height: 480,
      blurDataURL: "data:image/webp;base64,preview",
    },
    favicon: {
      url: "https://media.test/favicon.webp",
      width: 32,
      height: 32,
    },
    video: {
      provider: "youtube",
      videoId: "dQw4w9WgXcQ",
      channelName: null,
      channelUrl: null,
    },
  });
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
