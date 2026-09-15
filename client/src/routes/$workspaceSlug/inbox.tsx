import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useInboxContents, useMarkInboxSeen } from "@/api/collection";
import {
  type ColorSearchResult,
  useColorImageSearch,
} from "@/api/color-search";
import { AssetBoard } from "@/components/board/asset-board";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { BoardContextMenu, BoardUploadZone } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { MasonryGridSkeleton } from "@/components/masonry-grid-skeleton";
import { DEFAULT_FILTER_BAR_STATE } from "@/store/slices/filter-bar-slice";
import { useSessionStore } from "@/store";
import type { ImageAsset } from "@/types/asset";
import { ResourceLoadError } from "@/components/resource-load-error";
import {
  useWorkspacePeek,
  type BoardShowRequest,
} from "@/components/app-shell/workspace-peek";
import { useWorkspaceAssetView } from "@/components/app-shell/workspace-asset-view";

export const Route = createFileRoute("/$workspaceSlug/inbox")({
  head: () => ({
    meta: [{ title: "Inbox | Aska" }],
  }),
  component: InboxPage,
  pendingComponent: MasonryGridSkeleton,
});

function InboxPage() {
  const { workspaceSlug } = Route.useParams();
  const filterScope = `inbox:${workspaceSlug}`;
  const { showRequest, consumeShowRequest } = useWorkspacePeek();
  const { openAsset } = useWorkspaceAssetView();
  const filterBar = useSessionStore(
    (state) => state.filterBars[filterScope] ?? DEFAULT_FILTER_BAR_STATE,
  );
  const selectedAssetTypes =
    filterBar.filterType === "Type" ? (filterBar.selectedAssetTypes ?? []) : [];
  const { data, isLoading, isFetching, isError, refetch } = useInboxContents(
    workspaceSlug,
    selectedAssetTypes,
  );
  const { mutate: markInboxSeen } = useMarkInboxSeen(workspaceSlug);
  const [focusedShowRequest, setFocusedShowRequest] =
    useState<BoardShowRequest>();
  const selectedColorHexes =
    filterBar.filterType === "Color" ? filterBar.selectedColors : [];
  const isTypeFilterActive = selectedAssetTypes.length > 0;
  const colorSearch = useColorImageSearch(
    workspaceSlug,
    { type: "inbox" },
    selectedColorHexes,
  );

  useEffect(() => {
    if (data) markInboxSeen();
  }, [data, markInboxSeen]);

  const assets = data?.nodes.map(collectionNodeToAsset) ?? [];
  const hasResolvedColorSearch =
    selectedColorHexes.length > 0 && colorSearch.data !== undefined;
  const displayAssets = hasResolvedColorSearch
    ? colorSearch.data.results.map(colorSearchResultToImageAsset)
    : assets;

  useEffect(() => {
    if (!showRequest || showRequest.scopeKey !== filterScope || !data) return;
    if (!data.nodes.some((node) => node.id === showRequest.assetId)) {
      if (isFetching) return;
      toast.error("This asset is no longer at that location.");
      consumeShowRequest(showRequest.id);
      return;
    }

    setFocusedShowRequest(showRequest);
    consumeShowRequest(showRequest.id);
  }, [consumeShowRequest, data, filterScope, isFetching, showRequest]);

  if (isLoading) return <MasonryGridSkeleton />;

  if (isError && !data) {
    return (
      <ResourceLoadError
        isRetrying={isFetching}
        resourceName="inbox"
        onRetry={() => void refetch()}
      />
    );
  }

  const handleOpenAsset = (assetId: string) => {
    const node = data?.nodes.find((candidate) => candidate.id === assetId);
    openAsset(assetId, {
      initialData:
        node && node.type !== "folder"
          ? { asset: node, location: { type: "inbox" } }
          : undefined,
      imageSiblings: data?.nodes.filter(
        (
          candidate,
        ): candidate is Extract<typeof candidate, { type: "image" }> =>
          candidate.type === "image",
      ),
    });
  };

  return (
    <BoardContextMenu
      workspaceSlug={workspaceSlug}
      collectionPath=""
      target="inbox"
    >
      <BoardUploadZone
        workspaceSlug={workspaceSlug}
        collectionPath=""
        target="inbox"
      >
        <AssetBoard
          assets={displayAssets}
          inboxContext={{ workspaceSlug }}
          focusedAssetId={focusedShowRequest?.assetId}
          focusRequestId={focusedShowRequest?.id}
          onDismissFocusedAsset={() => setFocusedShowRequest(undefined)}
          onOpenNote={(note) => handleOpenAsset(note.id)}
          onOpenImage={(image) => handleOpenAsset(image.id)}
          onOpenColor={(color) => handleOpenAsset(color.id)}
          onOpenVideo={(video) => handleOpenAsset(video.id)}
          emptyTitle={
            hasResolvedColorSearch || isTypeFilterActive
              ? "No matching assets"
              : "Inbox is empty"
          }
          emptyDescription={
            hasResolvedColorSearch
              ? "Try a different color combination."
              : isTypeFilterActive
                ? "Try a different asset type."
                : "Quick captures and imports that are not in a collection yet will appear here."
          }
        />
        {(assets.length > 0 || selectedAssetTypes.length > 0) && (
          <FilterBar
            scope={filterScope}
            searchStatus={{
              resultCount: hasResolvedColorSearch
                ? colorSearch.data.results.length
                : isTypeFilterActive && !isFetching
                  ? assets.length
                  : undefined,
              isSearching:
                colorSearch.isSearching || (isTypeFilterActive && isFetching),
            }}
          />
        )}
      </BoardUploadZone>
    </BoardContextMenu>
  );
}

function colorSearchResultToImageAsset(result: ColorSearchResult): ImageAsset {
  return {
    id: result.image.id,
    type: "image",
    url: result.image.url,
    width: result.image.width,
    height: result.image.height,
    title: result.image.title ?? undefined,
    alt: result.image.alt ?? undefined,
    blurDataURL: result.image.blurDataURL ?? undefined,
    dominantColors: result.image.dominantColors,
  };
}
