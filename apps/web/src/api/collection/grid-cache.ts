import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";
import type {
  CollectionContentsResponse,
  CollectionGridResponse,
  CollectionNode,
  InboxContentsResponse,
  InboxGridResponse,
} from "./types";

// Keep cached views in sync even while their components are unmounted.
export function synchronizeGridCaches(client: QueryClient) {
  const previous = new Map<
    string,
    CollectionContentsResponse | InboxContentsResponse | undefined
  >();
  return client.getQueryCache().subscribe((event) => {
    const key = event.query.queryKey;
    const inbox = key[0] === "inboxContents" && key.length === 2;
    const collection = key[0] === "collectionContents" && key.length === 4;
    if (!inbox && !collection) return;
    const hash = event.query.queryHash;
    if (event.type === "removed") {
      previous.delete(hash);
      return;
    }
    if (event.type !== "updated") return;
    const next = event.query.state.data as
      | CollectionContentsResponse
      | InboxContentsResponse
      | undefined;
    const before = previous.get(hash);
    previous.set(hash, next);
    const prefix = inbox
      ? ["inboxGrid", key[1]]
      : ["collectionGrid", key[1], key[2], key[3] ?? ""];
    if (event.action.type === "invalidate") {
      void client.invalidateQueries({ queryKey: prefix });
      return;
    }
    if (event.action.type !== "success" || !next) return;
    if (!event.action.manual) {
      void client.invalidateQueries({ queryKey: prefix });
      return;
    }
    const oldNodes = new Map(
      (before?.nodes ?? []).map((node) => [node.id, node]),
    );
    const newNodes = new Map(next.nodes.map((node) => [node.id, node]));
    for (const [gridKey, grid] of client.getQueriesData<
      InfiniteData<CollectionGridResponse | InboxGridResponse>
    >({ queryKey: prefix })) {
      if (!grid?.pages.length) continue;
      const filters = inbox
        ? String(gridKey[2] ?? "")
            .split(",")
            .filter(Boolean)
        : (gridKey.slice(4) as string[]);
      const keep = (nodes: CollectionNode[]) =>
        nodes
          .filter((node) => !oldNodes.has(node.id) || newNodes.has(node.id))
          .map((node) => newNodes.get(node.id) ?? node);
      const pages = grid.pages.map((page) =>
        "nodes" in page
          ? { ...page, nodes: keep(page.nodes) }
          : { ...page, folders: keep(page.folders), assets: keep(page.assets) },
      );
      const existing = new Set(
        pages.flatMap((page) =>
          ("nodes" in page
            ? page.nodes
            : [...page.folders, ...page.assets]
          ).map((node) => node.id),
        ),
      );
      const added = next.nodes.filter(
        (node) =>
          !oldNodes.has(node.id) &&
          !existing.has(node.id) &&
          (!filters.length || filters.includes(node.type)),
      );
      const first = pages[0]!;
      pages[0] =
        "nodes" in first
          ? { ...first, nodes: [...added, ...first.nodes] }
          : {
              ...first,
              folders: [
                ...added.filter((node) => node.type === "folder"),
                ...first.folders,
              ],
              assets: [
                ...added.filter((node) => node.type !== "folder"),
                ...first.assets,
              ],
            };
      client.setQueryData(gridKey, { ...grid, pages });
    }
  });
}

// Apply a contents update to the loaded grid pages when no full canvas query
// exists. Grid pages are deliberately never stored as complete canvas data.
export function updateCollectionContents(
  client: QueryClient,
  key: QueryKey,
  update: (
    current: CollectionContentsResponse | undefined,
  ) => CollectionContentsResponse | undefined,
) {
  const current = client.getQueryData<CollectionContentsResponse>(key);
  if (current) {
    client.setQueryData<CollectionContentsResponse>(key, update);
    return;
  }
  const [, workspace, collection, folder] = key;
  const prefix = ["collectionGrid", workspace, collection, folder ?? ""];
  for (const [gridKey, grid] of client.getQueriesData<
    InfiniteData<CollectionGridResponse>
  >({ queryKey: prefix })) {
    if (!grid?.pages[0]) continue;
    void client.cancelQueries({ queryKey: gridKey, exact: true });
    const nodes = grid.pages.flatMap((page) => [
      ...page.folders,
      ...page.assets,
    ]);
    const next = update({
      collection: grid.pages[0].collection,
      breadcrumbs: grid.pages[0].breadcrumbs,
      nodes,
      canvasObjects: [],
    });
    if (!next) continue;
    const before = new Set(nodes.map((node) => node.id));
    const after = new Map(next.nodes.map((node) => [node.id, node]));
    const filters = gridKey.slice(4) as string[];
    const added = next.nodes.filter(
      (node) =>
        !before.has(node.id) &&
        (!filters.length || filters.includes(node.type)),
    );
    const retain = (items: CollectionNode[]) =>
      items.flatMap((node) => {
        const replacement = after.get(node.id);
        return replacement ? [replacement] : [];
      });
    const pages = grid.pages.map((page) => ({
      ...page,
      folders: retain(page.folders),
      assets: retain(page.assets),
    }));
    pages[0] = {
      ...pages[0]!,
      folders: [
        ...added.filter((node) => node.type === "folder"),
        ...pages[0]!.folders,
      ],
      assets: [
        ...added.filter((node) => node.type !== "folder"),
        ...pages[0]!.assets,
      ],
    };
    client.setQueryData(gridKey, { ...grid, pages });
  }
}
