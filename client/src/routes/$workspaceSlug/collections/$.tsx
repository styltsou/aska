import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { collectionQueryKeys } from "@/api/collection/query-keys";
import {
  type CollectionNoteNode,
  useCollectionContents,
} from "@/api/collection";
import { type ColorSearchScope, useColorImageSearch } from "@/api/color-search";
import { NoteDetailDrawer } from "@/components/board/note-detail-drawer";
import { usePersistedNoteDrawer } from "@/components/board/use-persisted-note-drawer";
import { BoardContextMenu, BoardUploadZone } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import type { ImageAsset } from "@/types/asset";
import { ImageAssetViewer } from "@/components/board/image-asset-viewer";
import { usePersistedImageViewer } from "@/components/board/use-persisted-image-viewer";
import {
  makeBoardKey,
  Canvas,
  CanvasLoading,
  BrowseLoading,
  CollectionNotFound,
  FolderNotFound,
} from "@/components/canvas";
import { ApiError } from "@/lib/api";
import { getCollectionViewScope, useSessionStore } from "@/store";
import { DEFAULT_FILTER_BAR_STATE } from "@/store/slices/filter-bar-slice";
import { ResourceLoadError } from "@/components/resource-load-error";
import { CollectionBrowseView } from "@/components/collection-browse-view";

const EMPTY_COLOR_RESULTS: readonly [] = [];

export const Route = createFileRoute("/$workspaceSlug/collections/$")({
  validateSearch: (_search: Record<string, unknown>) => ({}),
  head: () => ({
    meta: [{ title: "Collection | Aska" }],
  }),
  component: CollectionPage,
  pendingComponent: CanvasLoading,
});

function CollectionPage() {
  const { workspaceSlug, _splat } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const collectionPath = _splat ?? "";
  const { drawerNote, openDrawer, closeDrawer, updateDrawerNote } =
    usePersistedNoteDrawer(
      `aska.note-drawer:collection:${workspaceSlug}:${collectionPath}`,
    );
  const { viewerImage, openViewer, closeViewer } = usePersistedImageViewer(
    `aska.image-viewer:collection:${workspaceSlug}:${collectionPath}`,
  );
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const folderPath = folderSegments.join("/");
  const queryClient = useQueryClient();
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

  const assets = data?.nodes.map(collectionNodeToAsset) ?? [];
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
      <BrowseLoading />
    );
  }

  const handleOpenNote = (
    note: CollectionNoteNode,
    _mode: "read" | "edit" = "read",
  ) => {
    const asset = collectionNodeToAsset(note);
    if (asset.type === "note") openDrawer(asset);
  };

  const handleCloseNote = () => closeDrawer();

  const handleCloseImage = () => closeViewer();

  const handleSelectViewerImage = (image: ImageAsset) => {
    openViewer(image);
  };

  const handleOpenImage = (
    image: Extract<(typeof nodes)[number], { type: "image" }>,
  ) => {
    const asset = collectionNodeToAsset(image);
    if (asset.type === "image") handleSelectViewerImage(asset);
  };

  const handleOpenFolder = (
    folder: Extract<(typeof nodes)[number], { type: "folder" }>,
  ) => {
    closeDrawer();
    void navigate({
      to: "/$workspaceSlug/collections/$",
      params: {
        workspaceSlug,
        _splat: `${collectionPath}/${folder.slug}`,
      },
      search: {},
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
        showCanvasControls={boardView === "canvas"}
      >
        <BoardUploadZone
          workspaceSlug={workspaceSlug}
          collectionPath={collectionPath}
          boardKey={boardKey}
        >
          <div className="relative flex h-full min-w-0 flex-1">
            {boardView === "canvas" ? (
              <Canvas
                key={boardKey}
                workspaceSlug={workspaceSlug}
                collectionSlug={collectionSlug}
                folderPath={parentFolderPath}
                expectedParentFolderNodeId={
                  activeFolder ? `folder-${activeFolder.id}` : null
                }
                nodes={nodes}
                isColorFilterActive={hasResolvedColorSearch}
                colorMatchNodeIds={colorMatchNodeIds}
                focusedNodeId={focusedColorNodeId}
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
                onOpenNote={handleOpenNote}
                onOpenImage={handleOpenImage}
                onOpenFolder={handleOpenFolder}
              />
            ) : (
              <CollectionBrowseView
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
                focusedNodeId={focusedColorNodeId}
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
                onOpenNote={handleOpenNote}
                onOpenImage={handleOpenImage}
                onOpenFolder={handleOpenFolder}
              />
            )}
          </div>
        </BoardUploadZone>
      </BoardContextMenu>
      <NoteDetailDrawer
        note={drawerNote}
        onNoteChange={updateDrawerNote}
        workspaceSlug={workspaceSlug}
        noteExtractionTarget={{
          collectionSlug,
          parentFolderPath,
        }}
        onClose={handleCloseNote}
      />
      <ImageAssetViewer
        asset={viewerImage}
        assets={assets.filter(
          (asset): asset is ImageAsset => asset.type === "image",
        )}
        open={viewerImage !== undefined}
        workspaceSlug={workspaceSlug}
        onAssetChange={handleSelectViewerImage}
        onOpenChange={(open) => {
          if (!open) handleCloseImage();
        }}
      />
      {(assets.length > 0 || selectedAssetTypes.length > 0) && (
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
    </>
  );
}
