import { QueryClient, type InfiniteData } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { synchronizeGridCaches, updateCollectionContents } from "./grid-cache";
import type { CollectionGridResponse, CollectionNode } from "./types";

describe("updateCollectionContents", () => {
  it("synchronizes cached inbox pages while the inbox view is unmounted", () => {
    const client = new QueryClient();
    const stop = synchronizeGridCaches(client);
    const inboxKey = ["inboxContents", "workspace"];
    const gridKey = ["inboxGrid", "workspace", ""];
    const node = { id: "one", type: "note" } as CollectionNode;
    const contents = {
      collection: { id: 0, name: "Inbox", slug: "inbox" },
      breadcrumbs: [],
      nodes: [node],
    };
    client.setQueryData(inboxKey, contents);
    client.setQueryData(gridKey, {
      pages: [{ ...contents, nextCursor: null }],
      pageParams: [undefined],
    });
    client.setQueryData(inboxKey, { ...contents, nodes: [] });
    expect(
      client.getQueryData<{ pages: { nodes: CollectionNode[] }[] }>(gridKey)
        ?.pages[0]?.nodes,
    ).toEqual([]);
    void client.invalidateQueries({ queryKey: inboxKey });
    expect(client.getQueryState(gridKey)?.isInvalidated).toBe(true);
    stop();
  });
  it("updates paginated grids without populating the full canvas cache", () => {
    const client = new QueryClient();
    const key = ["collectionContents", "workspace", "collection", undefined];
    const gridKey = ["collectionGrid", "workspace", "collection", ""];
    const filteredKey = [...gridKey, "color"];
    const original = { id: "existing", type: "note" } as CollectionNode;
    const pending = { id: "note-optimistic", type: "note" } as CollectionNode;
    const saved = { id: "saved", type: "note" } as CollectionNode;
    const grid = {
      pages: [
        {
          collection: { id: 1, name: "Collection", slug: "collection" },
          breadcrumbs: [],
          folders: [],
          assets: [original],
          nextCursor: "next",
        },
      ],
      pageParams: [undefined],
    } satisfies InfiniteData<CollectionGridResponse>;
    client.setQueryData(gridKey, grid);
    client.setQueryData(filteredKey, {
      ...grid,
      pages: [{ ...grid.pages[0], assets: [] }],
    });

    updateCollectionContents(
      client,
      key,
      (current) =>
        current && { ...current, nodes: [...current.nodes, pending] },
    );
    expect(client.getQueryData(key)).toBeUndefined();
    expect(
      client
        .getQueryData<InfiniteData<CollectionGridResponse>>(gridKey)
        ?.pages[0]?.assets.map((node) => node.id),
    ).toEqual([pending.id, original.id]);
    expect(
      client.getQueryData<InfiniteData<CollectionGridResponse>>(filteredKey)
        ?.pages[0]?.assets,
    ).toEqual([]);

    updateCollectionContents(
      client,
      key,
      (current) =>
        current && {
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === pending.id ? saved : node,
          ),
        },
    );
    expect(
      client
        .getQueryData<InfiniteData<CollectionGridResponse>>(gridKey)
        ?.pages[0]?.assets.map((node) => node.id),
    ).toEqual([saved.id, original.id]);
    updateCollectionContents(
      client,
      key,
      (current) =>
        current && {
          ...current,
          nodes: current.nodes.filter((node) => node.id !== saved.id),
        },
    );
    expect(
      client.getQueryData<InfiniteData<CollectionGridResponse>>(gridKey)
        ?.pages[0]?.assets,
    ).toEqual([original]);
  });
});
