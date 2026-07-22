import type {
  CollectionContentsResponse,
  CollectionNode,
  CollectionsData,
  FolderChildPreview,
} from "./types";

const MAX_COLLECTION_PREVIEWS = 4;

type AssetNode = Exclude<CollectionNode, { type: "folder" }>;

export type CollectionContentsCacheEntry = [
  readonly unknown[],
  CollectionContentsResponse,
];

type CachedMoveInput = {
  sourceFolderPath?: string;
  targetFolderPath: string;
  sourceParentFolderPath?: string;
  sourceFolderSlug?: string;
  targetFolderNodeId: string;
  movedNode: CollectionNode;
  preview?: FolderChildPreview;
  remainingUnfilteredSourceNodes?: CollectionNode[];
};

export function getAssetPreview(node: AssetNode): FolderChildPreview {
  if (node.type === "image") {
    return {
      assetId: node.id,
      type: "image",
      url: node.url,
      blurDataURL: node.blurDataURL,
    };
  }

  return {
    assetId: node.id,
    type: "note",
    color: node.color ?? undefined,
    snippet: makeSnippet(node.content),
  };
}

export function removeNodeFromContents(
  contents: CollectionContentsResponse,
  nodeId: string,
): {
  contents: CollectionContentsResponse;
  node: CollectionNode | undefined;
  index: number;
} {
  const index = contents.nodes.findIndex((node) => node.id === nodeId);
  const node = contents.nodes[index];

  if (!node) {
    return { contents, node: undefined, index: -1 };
  }

  return {
    contents: {
      ...contents,
      nodes: contents.nodes.filter((current) => current.id !== nodeId),
    },
    node,
    index,
  };
}

export function restoreNodeToContents(
  contents: CollectionContentsResponse,
  node: CollectionNode,
  index: number,
): CollectionContentsResponse {
  if (contents.nodes.some((current) => current.id === node.id)) return contents;

  const insertionIndex = Math.max(0, Math.min(index, contents.nodes.length));
  return {
    ...contents,
    nodes: [
      ...contents.nodes.slice(0, insertionIndex),
      node,
      ...contents.nodes.slice(insertionIndex),
    ],
  };
}

export function appendMovedNodeToContents(
  contents: CollectionContentsResponse,
  node: CollectionNode,
): CollectionContentsResponse {
  if (contents.nodes.some((current) => current.id === node.id)) return contents;

  return {
    ...contents,
    nodes: [...contents.nodes, { ...node, position: null }],
  };
}

export function updateTargetFolderForMove(
  contents: CollectionContentsResponse,
  targetFolderNodeId: string,
  preview: FolderChildPreview | undefined,
  countDelta: number,
): CollectionContentsResponse {
  return {
    ...contents,
    nodes: contents.nodes.map((node) =>
      node.type === "folder" && node.id === targetFolderNodeId
        ? {
            ...node,
            count: Math.max(0, node.count + countDelta),
            previews: preview
              ? countDelta > 0
                ? [
                    preview,
                    ...node.previews.filter(
                      (current) => current.assetId !== preview.assetId,
                    ),
                  ].slice(0, MAX_COLLECTION_PREVIEWS)
                : node.previews.filter(
                    (current) => current.assetId !== preview.assetId,
                  )
              : node.previews,
          }
        : node,
    ),
  };
}

export function transitionCachedContentsForMove(
  entries: CollectionContentsCacheEntry[],
  input: CachedMoveInput,
): CollectionContentsCacheEntry[] {
  const movedAssetCount =
    input.movedNode.type === "folder" ? input.movedNode.count : 1;
  const updates: CollectionContentsCacheEntry[] = [];

  for (const [key, current] of entries) {
    const cachedFolderPath = getFolderPathFromKey(key);

    if (cachedFolderPath === input.sourceFolderPath) {
      const removal = removeNodeFromContents(current, input.movedNode.id);
      updates.push([
        key,
        updateTargetFolderForMove(
          removal.contents,
          input.targetFolderNodeId,
          input.preview,
          movedAssetCount,
        ),
      ]);
      continue;
    }

    if (
      cachedFolderPath === input.targetFolderPath &&
      contentsKeyIncludesNodeType(key, input.movedNode.type)
    ) {
      updates.push([key, appendMovedNodeToContents(current, input.movedNode)]);
      continue;
    }

    if (
      input.preview &&
      input.sourceFolderSlug &&
      input.remainingUnfilteredSourceNodes &&
      cachedFolderPath === input.sourceParentFolderPath
    ) {
      updates.push([
        key,
        recomputeFolderPreviews(
          current,
          input.sourceFolderSlug,
          input.remainingUnfilteredSourceNodes,
        ),
      ]);
    }
  }

  return updates;
}

export function recomputeFolderPreviews(
  contents: CollectionContentsResponse,
  folderSlug: string,
  directChildren: CollectionNode[],
): CollectionContentsResponse {
  const previews = [...directChildren]
    .reverse()
    .filter((node): node is AssetNode => node.type !== "folder")
    .map(getAssetPreview)
    .slice(0, MAX_COLLECTION_PREVIEWS);

  return {
    ...contents,
    nodes: contents.nodes.map((node) =>
      node.type === "folder" && node.slug === folderSlug
        ? { ...node, previews }
        : node,
    ),
  };
}

export function getCollectionPreviewIndex(
  collections: CollectionsData | undefined,
  collectionSlug: string,
  assetId: string,
): number {
  return (
    collections?.collections
      .find((collection) => collection.slug === collectionSlug)
      ?.previews.findIndex((preview) => preview.assetId === assetId) ?? -1
  );
}

export function promoteCollectionPreview(
  collections: CollectionsData,
  collectionSlug: string,
  preview: FolderChildPreview,
): CollectionsData {
  return {
    collections: collections.collections.map((collection) =>
      collection.slug === collectionSlug
        ? {
            ...collection,
            previews: [
              preview,
              ...collection.previews.filter(
                (current) => current.assetId !== preview.assetId,
              ),
            ].slice(0, MAX_COLLECTION_PREVIEWS),
          }
        : collection,
    ),
  };
}

export function rollbackCollectionPreview(
  collections: CollectionsData,
  collectionSlug: string,
  preview: FolderChildPreview,
  originalIndex: number,
): CollectionsData {
  return {
    collections: collections.collections.map((collection) => {
      if (collection.slug !== collectionSlug) return collection;

      const remaining = collection.previews.filter(
        (current) => current.assetId !== preview.assetId,
      );
      if (originalIndex < 0) return { ...collection, previews: remaining };

      const insertionIndex = Math.min(originalIndex, remaining.length);
      return {
        ...collection,
        previews: [
          ...remaining.slice(0, insertionIndex),
          preview,
          ...remaining.slice(insertionIndex),
        ].slice(0, MAX_COLLECTION_PREVIEWS),
      };
    }),
  };
}

function makeSnippet(content: string, maxLength = 1000): string {
  const singleLine = content.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  return singleLine.length > maxLength
    ? `${singleLine.slice(0, maxLength).trimEnd()}...`
    : singleLine;
}

function getFolderPathFromKey(key: readonly unknown[]): string | undefined {
  return typeof key[3] === "string" ? key[3] : undefined;
}

function contentsKeyIncludesNodeType(
  key: readonly unknown[],
  nodeType: CollectionNode["type"],
): boolean {
  const typeSignature = key[4];
  return (
    typeof typeSignature !== "string" ||
    typeSignature.split(",").includes(nodeType)
  );
}
