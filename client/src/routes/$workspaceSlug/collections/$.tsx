import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { collectionQueryKeys } from "@/api/collection/query-keys";
import {
  fetchCollectionContents,
  fetchCollectionGrid,
} from "@/api/collection/fetchers";
import {
  useCollectionContents,
  type CanvasObject,
  type CollectionNode,
} from "@/api/collection";
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
import {
  getCollectionViewScope,
  usePersistedStore,
  useSessionStore,
} from "@/store";
import { DEFAULT_FILTER_BAR_STATE } from "@/store/slices/filter-bar-slice";
import { ResourceLoadError } from "@/components/resource-load-error";
import { CollectionGridView } from "@/components/collection-grid-view";
import {
  useWorkspacePeek,
  type BoardShowRequest,
} from "@/components/app-shell/workspace-peek";
import { useWorkspaceAssetView } from "@/components/app-shell/workspace-asset-view";
import { useWorkspaceOverlayNavigation } from "@/components/app-shell/use-workspace-overlay-navigation";
import { parseWorkspaceAssetPath } from "@/lib/workspace-asset-url";

const EMPTY_COLOR_RESULTS: readonly [] = [];
const EMPTY_COLLECTION_NODES: CollectionNode[] = [];
const EMPTY_CANVAS_OBJECTS: readonly CanvasObject[] = [];
const StableCanvas = memo(Canvas);
const StableCollectionGridView = memo(CollectionGridView);

export const Route = createFileRoute("/$workspaceSlug/collections/$")({
  head: () => ({
    meta: [{ title: "Collection | Aska" }],
  }),
  component: CollectionPage,
  pendingComponent: CanvasLoading,
});

function CollectionPage() {
  const { workspaceSlug, _splat } = Route.useParams();
  const navigateOverlay = useWorkspaceOverlayNavigation();
  const { showRequest, consumeShowRequest } = useWorkspacePeek();
  const { openAsset } = useWorkspaceAssetView();
  const collectionPath = parseWorkspaceAssetPath(
    `/${workspaceSlug}/collections/${_splat ?? ""}`,
  ).boardPathname.slice(`/${workspaceSlug}/collections/`.length);
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const folderPath = folderSegments.join("/");
  const collectionViewScope = getCollectionViewScope(
    workspaceSlug,
    collectionSlug,
  );
  const boardView = usePersistedStore(
    (state) => state.collectionViews[collectionViewScope] ?? "canvas",
  );
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
    data: canvasData,
    isLoading: isCanvasLoading,
    isFetching: isCanvasFetching,
    isError: isCanvasError,
    isPlaceholderData: isCanvasPlaceholderData,
    error: canvasError,
    refetch: refetchCanvas,
  } = useCollectionContents(
    workspaceSlug,
    collectionSlug,
    folderPath || undefined,
    {
      types: requestedAssetTypes,
      enabled:
        boardView === "canvas" ||
        (filterBar.filterType === "Color" &&
          filterBar.selectedColors.length > 0),
    },
  );
  const gridQuery = useInfiniteQuery({
    queryKey: [
      "collectionGrid",
      workspaceSlug,
      collectionSlug,
      folderPath,
      ...requestedAssetTypes,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchCollectionGrid(
        workspaceSlug,
        collectionSlug,
        folderPath || undefined,
        requestedAssetTypes,
        pageParam,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:
      boardView === "grid" &&
      !(
        filterBar.filterType === "Color" && filterBar.selectedColors.length > 0
      ) &&
      !!workspaceSlug &&
      !!collectionSlug,
  });
  const gridPages = gridQuery.data?.pages;
  const gridData = useMemo(
    () =>
      gridPages?.[0]
        ? {
            collection: gridPages[0].collection,
            breadcrumbs: gridPages[0].breadcrumbs,
            nodes: [
              ...gridPages[0].folders,
              ...gridPages.flatMap((page) => page.assets),
            ],
            canvasObjects: EMPTY_CANVAS_OBJECTS,
          }
        : undefined,
    [gridPages],
  );
  const useGridPages =
    boardView === "grid" &&
    !(filterBar.filterType === "Color" && filterBar.selectedColors.length > 0);
  const data = useGridPages ? gridData : canvasData;
  const isLoading = useGridPages ? gridQuery.isLoading : isCanvasLoading;
  const isFetching = useGridPages ? gridQuery.isFetching : isCanvasFetching;
  const isError = useGridPages ? gridQuery.isError : isCanvasError;
  const isPlaceholderData = useGridPages ? false : isCanvasPlaceholderData;
  const error = useGridPages ? gridQuery.error : canvasError;
  const refetch = useGridPages ? gridQuery.refetch : refetchCanvas;

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

  const nodes = data?.nodes ?? EMPTY_COLLECTION_NODES;
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
  const dismissFocusedNode = useCallback(
    () => setFocusedShowRequest(undefined),
    [],
  );
  const handleOpenFolder = useCallback(
    (folder: Extract<CollectionNode, { type: "folder" }>) => {
      void navigateOverlay(
        `/${workspaceSlug}/collections/${collectionPath}/${folder.slug}`,
      );
    },
    [collectionPath, navigateOverlay, workspaceSlug],
  );
  const handleOpenAsset = useCallback(
    (assetId: string, origin?: "canvas" | "grid") => {
      const node = nodes.find((candidate) => candidate.id === assetId);
      const location = {
        type: "collection" as const,
        collectionSlug,
        folderPath: parentFolderPath,
      };
      openAsset(assetId, {
        origin,
        initialData:
          node && node.type !== "folder"
            ? { asset: node, location }
            : undefined,
        imageSiblings: nodes.filter(
          (
            candidate,
          ): candidate is Extract<typeof candidate, { type: "image" }> =>
            candidate.type === "image",
        ),
      });
    },
    [collectionSlug, nodes, openAsset, parentFolderPath],
  );
  const handleOpenCanvasNode = useCallback(
    (node: { id: string }) => handleOpenAsset(node.id, "canvas"),
    [handleOpenAsset],
  );
  const handleOpenNode = useCallback(
    (node: { id: string }) => handleOpenAsset(node.id, "grid"),
    [handleOpenAsset],
  );

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

  const showLoading =
    isLoading ||
    (hasStaleRoutePlaceholder && !isError) ||
    (boardView === "grid" && isPlaceholderData && !isError);

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
        disabled={boardView !== "canvas"}
      >
        <BoardUploadZone
          workspaceSlug={workspaceSlug}
          collectionPath={collectionPath}
          boardKey={boardKey}
        >
          <div className="relative flex h-full min-w-0 flex-1">
            <BoardActionRail
              workspaceSlug={workspaceSlug}
              collectionPath={collectionPath}
              view={boardView}
            />
            {showLoading ? (
              boardView === "canvas" ? (
                <CanvasLoading
                  workspaceSlug={workspaceSlug}
                  collectionSlug={collectionSlug}
                  folderPath={parentFolderPath}
                />
              ) : (
                <GridViewLoading />
              )
            ) : (
              <>
                {boardView === "canvas" || isInactiveViewWarmed ? (
                  <Activity
                    mode={boardView === "canvas" ? "visible" : "hidden"}
                  >
                    <StableCanvas
                      key={boardKey}
                      workspaceSlug={workspaceSlug}
                      collectionSlug={collectionSlug}
                      folderPath={parentFolderPath}
                      expectedParentFolderNodeId={
                        activeFolder ? `folder-${activeFolder.id}` : null
                      }
                      nodes={nodes}
                      canvasObjects={
                        data?.canvasObjects ?? EMPTY_CANVAS_OBJECTS
                      }
                      isColorFilterActive={hasResolvedColorSearch}
                      colorMatchNodeIds={colorMatchNodeIds}
                      focusedNodeId={focusedNodeId}
                      focusRequestId={focusedShowRequest?.id}
                      onDismissFocusedNode={dismissFocusedNode}
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
                      onOpenNote={handleOpenCanvasNode}
                      onOpenImage={handleOpenCanvasNode}
                      onOpenColor={handleOpenCanvasNode}
                      onOpenVideo={handleOpenCanvasNode}
                      onOpenFolder={handleOpenFolder}
                    />
                  </Activity>
                ) : null}
                {boardView === "grid" || isInactiveViewWarmed ? (
                  <Activity mode={boardView === "grid" ? "visible" : "hidden"}>
                    <StableCollectionGridView
                      key={boardKey}
                      boardKey={boardKey}
                      workspaceSlug={workspaceSlug}
                      collectionSlug={collectionSlug}
                      folderPath={parentFolderPath}
                      expectedParentFolderNodeId={
                        activeFolder ? `folder-${activeFolder.id}` : null
                      }
                      nodes={nodes}
                      hasMoreAssets={useGridPages && gridQuery.hasNextPage}
                      isLoadingMore={gridQuery.isFetchingNextPage}
                      onLoadMore={
                        useGridPages
                          ? () => void gridQuery.fetchNextPage()
                          : undefined
                      }
                      onSelectAll={
                        useGridPages
                          ? async () =>
                              (
                                await fetchCollectionContents(
                                  workspaceSlug,
                                  collectionSlug,
                                  parentFolderPath,
                                  requestedAssetTypes,
                                )
                              ).nodes
                          : undefined
                      }
                      selectionFilterKey={requestedAssetTypes.join(",")}
                      isColorFilterActive={hasResolvedColorSearch}
                      colorMatchNodeIds={colorMatchNodeIds}
                      focusedNodeId={focusedNodeId}
                      focusRequestId={focusedShowRequest?.id}
                      onDismissFocusedNode={dismissFocusedNode}
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
                      onOpenNote={handleOpenNode}
                      onOpenImage={handleOpenNode}
                      onOpenColor={handleOpenNode}
                      onOpenVideo={handleOpenNode}
                      onOpenFolder={handleOpenFolder}
                    />
                  </Activity>
                ) : null}
              </>
            )}
          </div>
          {!showLoading &&
            (nodes.length > 0 || selectedAssetTypes.length > 0) && (
              <FilterBar
                scope={filterScope}
                searchStatus={{
                  resultCount: hasResolvedColorSearch
                    ? colorResults.length
                    : isTypeFilterActive && !isFetching
                      ? nodes.length
                      : undefined,
                  isSearching:
                    colorSearch.isSearching ||
                    (isTypeFilterActive && isFetching),
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
