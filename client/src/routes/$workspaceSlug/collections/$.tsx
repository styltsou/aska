import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { collectionQueryKeys } from "@/api/collection/query-keys";
import { useCollectionContents } from "@/api/collection";
import { type ColorSearchScope, useColorImageSearch } from "@/api/color-search";
import {
  BoardActionRail,
  BoardContextMenu,
  BoardUploadZone,
} from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import {
  makeBoardKey,
  Canvas,
  CanvasLoading,
  GridViewLoading,
  CollectionNotFound,
  FolderNotFound,
} from "@/components/canvas";
import { ApiError } from "@/lib/api";
import { getCollectionViewScope, useSessionStore } from "@/store";
import { DEFAULT_FILTER_BAR_STATE } from "@/store/slices/filter-bar-slice";
import { ResourceLoadError } from "@/components/resource-load-error";
import { CollectionGridView } from "@/components/collection-grid-view";
import {
  useWorkspacePeek,
  type BoardShowRequest,
} from "@/components/app-shell/workspace-peek";
import { useWorkspaceAssetView } from "@/components/app-shell/workspace-asset-view";

const EMPTY_COLOR_RESULTS: readonly [] = [];

export const Route = createFileRoute("/$workspaceSlug/collections/$")({
  head: () => ({
    meta: [{ title: "Collection | Aska" }],
  }),
  component: CollectionPage,
  pendingComponent: CanvasLoading,
});

function CollectionPage() {
  const { workspaceSlug, _splat } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const { showRequest, consumeShowRequest } = useWorkspacePeek();
  const { openAsset } = useWorkspaceAssetView();
  const collectionPath = _splat ?? "";
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const folderPath = folderSegments.join("/");
  const queryClient = useQueryClient();
  const [focusedShowRequest, setFocusedShowRequest] =
    useState<BoardShowRequest>();
  const filterScope = `collection:${workspaceSlug}/${collectionPath}`;
  const filterBar = useSessionStore(
    (state) => state.filterBars[filterScope] ?? DEFAULT_FILTER_BAR_STATE,
  );
  const selectedAssetTypes =
    filterBar.filterType === "Type" ? (filterBar.selectedAssetTypes ?? []) : [];
  const requestedAssetTypes =
    selectedAssetTypes.length > 0 && !selectedAssetTypes.includes("folder")
      ? [...selectedAssetTypes, "folder" as const]
      : selectedAssetTypes;
  const {
    data,
    isLoading,
    isFetching,
    isError,
    isPlaceholderData,
    error,
    refetch,
  } = useCollectionContents(
    workspaceSlug,
    collectionSlug,
    folderPath || undefined,
    {
      types: requestedAssetTypes,
    },
  );

  const cachedCollectionName = queryClient
    .getQueryData<{ collections: Array<{ slug: string; name: string }> }>(
      collectionQueryKeys.collections(workspaceSlug),
    )
    ?.collections.find((c) => c.slug === collectionSlug)?.name;

  useEffect(() => {
    const parts: string[] = [];
    if (data) {
      parts.push(data.collection.name);
      if (data.breadcrumbs.length > 0) {
        parts.unshift(data.breadcrumbs.at(-1)!.name);
      }
    } else if (cachedCollectionName) {
      parts.push(cachedCollectionName);
    }
    if (parts.length > 0) {
      document.title = `${parts.join(" · ")} | Aska`;
    }
  }, [data, cachedCollectionName]);

  const nodes = data?.nodes ?? [];
  const activeFolder = data?.breadcrumbs.at(-1);
  const resolvedFolderPath = data?.breadcrumbs
    .map((breadcrumb) => breadcrumb.slug)
    .join("/");
  const hasStaleRoutePlaceholder =
    isPlaceholderData && resolvedFolderPath !== folderPath;
  const parentFolderPath = folderPath || undefined;
  const selectedColorHexes =
    filterBar.filterType === "Color" ? filterBar.selectedColors : [];
  const isTypeFilterActive = selectedAssetTypes.length > 0;
  const colorSearchScope = useMemo<ColorSearchScope>(
    () => ({
      type: "collection",
      collectionSlug,
      folderPath: parentFolderPath,
      includeDescendants: false,
    }),
    [collectionSlug, parentFolderPath],
  );
  const colorSearch = useColorImageSearch(
    workspaceSlug,
    colorSearchScope,
    selectedColorHexes,
  );
  const colorResults = colorSearch.data?.results ?? EMPTY_COLOR_RESULTS;
  const colorResultSignature = colorResults
    .map((result) => result.location.nodeId)
    .join(",");
  const [focusedColorResult, setFocusedColorResult] = useState<
    { index: number; signature: string } | undefined
  >();
  const hasResolvedColorSearch =
    selectedColorHexes.length > 0 && colorSearch.data !== undefined;
  const focusedColorResultIndex =
    focusedColorResult?.signature === colorResultSignature
      ? focusedColorResult.index
      : undefined;
  const focusedColorNodeId =
    focusedColorResultIndex === undefined
      ? undefined
      : colorResults[focusedColorResultIndex]?.location.nodeId;
  const colorMatchNodeIds = useMemo(
    () => new Set(colorResults.map((result) => result.location.nodeId)),
    [colorResults],
  );
  const focusRelativeColorResult = useCallback(
    (direction: 1 | -1) => {
      if (colorResults.length === 0) return;

      setFocusedColorResult((current) => {
        const currentIndex =
          current?.signature === colorResultSignature
            ? current.index
            : undefined;
        const index =
          currentIndex === undefined
            ? direction === 1
              ? 0
              : colorResults.length - 1
            : (currentIndex + direction + colorResults.length) %
              colorResults.length;

        return { index, signature: colorResultSignature };
      });
    },
    [colorResultSignature, colorResults.length],
  );
  const boardKey = makeBoardKey(
    workspaceSlug,
    collectionSlug,
    parentFolderPath,
  );
  const collectionViewScope = getCollectionViewScope(
    workspaceSlug,
    collectionSlug,
  );
  const boardView = useSessionStore(
    (state) => state.collectionViews[collectionViewScope] ?? "canvas",
  );
  const [warmedBoardKey, setWarmedBoardKey] = useState<string>();
  const isInactiveViewWarmed = warmedBoardKey === boardKey;

  useEffect(() => {
    const warm = () => setWarmedBoardKey(boardKey);
    if (typeof window.requestIdleCallback === "function") {
      const idleCallback = window.requestIdleCallback(warm, { timeout: 750 });
      return () => window.cancelIdleCallback(idleCallback);
    }

    const timeout = window.setTimeout(warm, 250);
    return () => window.clearTimeout(timeout);
  }, [boardKey]);

  useEffect(() => {
    if (
      !showRequest ||
      showRequest.scopeKey !== filterScope ||
      !data ||
      hasStaleRoutePlaceholder
    ) {
      return;
    }
    if (!data.nodes.some((node) => node.id === showRequest.assetId)) {
      if (isFetching || isPlaceholderData) return;
      toast.error("This asset is no longer at that location.");
      consumeShowRequest(showRequest.id);
      return;
    }

    setFocusedShowRequest(showRequest);
    consumeShowRequest(showRequest.id);
  }, [
    consumeShowRequest,
    data,
    filterScope,
    hasStaleRoutePlaceholder,
    isFetching,
    isPlaceholderData,
    showRequest,
  ]);

  const focusedNodeId = focusedShowRequest?.assetId ?? focusedColorNodeId;

  const isNotFound =
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === "not_found";

  if (isNotFound) {
    const isFolderMissing = error.message.toLowerCase().includes("folder");
    return (
      <div className="flex h-full w-full min-w-0 flex-1">
        {isFolderMissing ? (
          <FolderNotFound
            workspaceSlug={workspaceSlug}
            collectionSlug={collectionSlug}
            collectionName={cachedCollectionName}
          />
        ) : (
          <CollectionNotFound
            workspaceSlug={workspaceSlug}
            collectionName={cachedCollectionName}
          />
        )}
      </div>
    );
  }

  if (isLoading || (hasStaleRoutePlaceholder && !isError)) {
    return boardView === "canvas" ? (
      <CanvasLoading
        workspaceSlug={workspaceSlug}
        collectionSlug={collectionSlug}
        folderPath={parentFolderPath}
      />
    ) : (
      <GridViewLoading />
    );
  }

  const handleOpenFolder = (
    folder: Extract<(typeof nodes)[number], { type: "folder" }>,
  ) => {
    void navigate({
      to: "/$workspaceSlug/collections/$",
      params: {
        workspaceSlug,
        _splat: `${collectionPath}/${folder.slug}`,
      },
      search: {},
    });
  };

  const handleOpenAsset = (assetId: string) => {
    const node = nodes.find((candidate) => candidate.id === assetId);
    const location = {
      type: "collection" as const,
      collectionSlug,
      folderPath: parentFolderPath,
    };
    openAsset(assetId, {
      initialData:
        node && node.type !== "folder" ? { asset: node, location } : undefined,
      imageSiblings: nodes.filter(
        (
          candidate,
        ): candidate is Extract<typeof candidate, { type: "image" }> =>
          candidate.type === "image",
      ),
    });
  };

  const loadError =
    isError && (!data || hasStaleRoutePlaceholder) ? (
      <ResourceLoadError
        className="min-h-0"
        isRetrying={isFetching}
        resourceName={folderPath ? "folder" : "collection"}
        onRetry={() => void refetch()}
      />
    ) : undefined;

  return (
    <>
      <BoardContextMenu
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
        boardKey={boardKey}
      >
        <BoardUploadZone
          workspaceSlug={workspaceSlug}
          collectionPath={collectionPath}
          boardKey={boardKey}
        >
          <div className="relative flex h-full min-w-0 flex-1">
            {boardView === "canvas" || isInactiveViewWarmed ? (
              <Activity mode={boardView === "canvas" ? "visible" : "hidden"}>
                <BoardActionRail
                  workspaceSlug={workspaceSlug}
                  collectionPath={collectionPath}
                />
                <Canvas
                  key={boardKey}
                  workspaceSlug={workspaceSlug}
                  collectionSlug={collectionSlug}
                  folderPath={parentFolderPath}
                  expectedParentFolderNodeId={
                    activeFolder ? `folder-${activeFolder.id}` : null
                  }
                  nodes={nodes}
                  canvasObjects={data?.canvasObjects ?? []}
                  isColorFilterActive={hasResolvedColorSearch}
                  colorMatchNodeIds={colorMatchNodeIds}
                  focusedNodeId={focusedNodeId}
                  focusRequestId={focusedShowRequest?.id}
                  onDismissFocusedNode={() => setFocusedShowRequest(undefined)}
                  loadError={loadError}
                  emptyTitle={
                    isTypeFilterActive
                      ? "No matching assets"
                      : folderPath
                        ? "Folder is empty"
                        : "Collection is empty"
                  }
                  emptyDescription={
                    isTypeFilterActive
                      ? "Try a different asset type."
                      : folderPath
                        ? "Add images, notes, links, or folders to start arranging this board."
                        : "Add images, notes, links, or folders to start arranging this collection."
                  }
                  onOpenNote={(note) => handleOpenAsset(note.id)}
                  onOpenImage={(image) => handleOpenAsset(image.id)}
                  onOpenColor={(color) => handleOpenAsset(color.id)}
                  onOpenVideo={(video) => handleOpenAsset(video.id)}
                  onOpenFolder={handleOpenFolder}
                />
              </Activity>
            ) : null}
            {boardView === "grid" || isInactiveViewWarmed ? (
              <Activity mode={boardView === "grid" ? "visible" : "hidden"}>
                <CollectionGridView
                  key={boardKey}
                  boardKey={boardKey}
                  workspaceSlug={workspaceSlug}
                  collectionSlug={collectionSlug}
                  folderPath={parentFolderPath}
                  expectedParentFolderNodeId={
                    activeFolder ? `folder-${activeFolder.id}` : null
                  }
                  nodes={nodes}
                  isColorFilterActive={hasResolvedColorSearch}
                  colorMatchNodeIds={colorMatchNodeIds}
                  focusedNodeId={focusedNodeId}
                  focusRequestId={focusedShowRequest?.id}
                  onDismissFocusedNode={() => setFocusedShowRequest(undefined)}
                  loadError={loadError}
                  emptyTitle={
                    isTypeFilterActive
                      ? "No matching assets"
                      : folderPath
                        ? "Folder is empty"
                        : "Collection is empty"
                  }
                  emptyDescription={
                    isTypeFilterActive
                      ? "Try a different asset type."
                      : folderPath
                        ? "Add images, notes, links, or folders to this folder."
                        : "Add images, notes, links, or folders to this collection."
                  }
                  onOpenNote={(note) => handleOpenAsset(note.id)}
                  onOpenImage={(image) => handleOpenAsset(image.id)}
                  onOpenColor={(color) => handleOpenAsset(color.id)}
                  onOpenVideo={(video) => handleOpenAsset(video.id)}
                  onOpenFolder={handleOpenFolder}
                />
              </Activity>
            ) : null}
          </div>
          {(nodes.length > 0 || selectedAssetTypes.length > 0) && (
            <FilterBar
              scope={filterScope}
              searchStatus={{
                resultCount: hasResolvedColorSearch
                  ? colorResults.length
                  : isTypeFilterActive && !isFetching
                    ? nodes.length
                    : undefined,
                isSearching:
                  colorSearch.isSearching || (isTypeFilterActive && isFetching),
                focusedResultIndex: hasResolvedColorSearch
                  ? focusedColorResultIndex
                  : undefined,
                onPrevious: hasResolvedColorSearch
                  ? () => focusRelativeColorResult(-1)
                  : undefined,
                onNext: hasResolvedColorSearch
                  ? () => focusRelativeColorResult(1)
                  : undefined,
              }}
            />
          )}
        </BoardUploadZone>
      </BoardContextMenu>
    </>
  );
}
