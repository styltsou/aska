import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { startTransition, useEffect } from "react";

import { useInboxContents, useMarkInboxSeen } from "@/api/collection";
import {
  type ColorSearchResult,
  useColorImageSearch,
} from "@/api/color-search";
import { AssetBoard } from "@/components/board/asset-board";
import { NoteDetailDrawer } from "@/components/board/note-detail-drawer";
import { useImmediateNoteDrawer } from "@/components/board/use-immediate-note-drawer";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { BoardContextMenu, BoardUploadZone } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { MasonryGridSkeleton } from "@/components/masonry-grid-skeleton";
import { DEFAULT_FILTER_BAR_STATE } from "@/store/slices/filter-bar-slice";
import { useSessionStore } from "@/store";
import type { ImageAsset, NoteAsset } from "@/types/asset";
import { ImageAssetViewer } from "@/components/board/image-asset-viewer";
import { useImmediateImageViewer } from "@/components/board/use-immediate-image-viewer";
import { ResourceLoadError } from "@/components/resource-load-error";

export const Route = createFileRoute("/$workspaceSlug/inbox")({
  validateSearch: (search: Record<string, unknown>) => ({
    note: typeof search.note === "string" ? search.note : undefined,
    image: typeof search.image === "string" ? search.image : undefined,
  }),
  head: () => ({
    meta: [{ title: "Inbox | Aska" }],
  }),
  component: InboxPage,
  pendingComponent: MasonryGridSkeleton,
});

function InboxPage() {
  const { workspaceSlug } = Route.useParams();
  const search = Route.useSearch();
  const selectedNoteId = search.note;
  const selectedImageId = search.image;
  const navigate = useNavigate({ from: Route.fullPath });
  const filterScope = `inbox:${workspaceSlug}`;
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
  const selectedNote = selectedNoteId
    ? (displayAssets.find(
        (a): a is NoteAsset => a.type === "note" && a.id === selectedNoteId,
      ) ?? undefined)
    : undefined;
  const selectedImage = selectedImageId
    ? (displayAssets.find(
        (a): a is ImageAsset => a.type === "image" && a.id === selectedImageId,
      ) ?? undefined)
    : undefined;
  const { drawerNote, openDrawer, closeDrawer } = useImmediateNoteDrawer(
    selectedNote,
    selectedNoteId,
  );
  const { viewerImage, openViewer, closeViewer } = useImmediateImageViewer(
    selectedImage,
    selectedImageId,
  );

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

  const handleOpenNote = (note: NoteAsset) => {
    openDrawer(note);
    void navigate({ search: (prev) => ({ ...prev, note: note.id }) });
  };

  const handleCloseNote = () => {
    closeDrawer();
    void navigate({ search: (prev) => ({ ...prev, note: undefined }) });
  };

  const handleOpenImage = (image: ImageAsset) => {
    openViewer(image);
    startTransition(() => {
      void navigate({ search: (prev) => ({ ...prev, image: image.id }) });
    });
  };

  const handleCloseImage = () => {
    closeViewer();
    startTransition(() => {
      void navigate({ search: (prev) => ({ ...prev, image: undefined }) });
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
          onOpenNote={handleOpenNote}
          onOpenImage={handleOpenImage}
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
      </BoardUploadZone>
      <NoteDetailDrawer note={drawerNote} onClose={handleCloseNote} />
      <ImageAssetViewer
        asset={viewerImage}
        open={viewerImage !== undefined}
        workspaceSlug={workspaceSlug}
        onOpenChange={(open) => {
          if (!open) handleCloseImage();
        }}
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
