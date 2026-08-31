import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useInboxContents, useMarkInboxSeen } from "@/api/collection";
import {
  type ColorSearchResult,
  useColorImageSearch,
} from "@/api/color-search";
import { AssetBoard } from "@/components/board/asset-board";
import { ColorDetailDrawer } from "@/components/board/color-detail-drawer";
import { ColorEditorDialog } from "@/components/app-shell/color-editor-dialog";
import { NoteDetailDrawer } from "@/components/board/note-detail-drawer";
import { usePersistedNoteDrawer } from "@/components/board/use-persisted-note-drawer";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { BoardContextMenu, BoardUploadZone } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { MasonryGridSkeleton } from "@/components/masonry-grid-skeleton";
import { DEFAULT_FILTER_BAR_STATE } from "@/store/slices/filter-bar-slice";
import { useSessionStore } from "@/store";
import type { ColorAsset, ImageAsset, NoteAsset } from "@/types/asset";
import { ImageAssetViewer } from "@/components/board/image-asset-viewer";
import { YouTubeVideoViewer } from "@/components/board/youtube-video-viewer";
import { usePersistedImageViewer } from "@/components/board/use-persisted-image-viewer";
import { usePersistedYouTubeVideoViewer } from "@/components/board/use-persisted-youtube-video-viewer";
import { ResourceLoadError } from "@/components/resource-load-error";

export const Route = createFileRoute("/$workspaceSlug/inbox")({
  validateSearch: (_search: Record<string, unknown>) => ({}),
  head: () => ({
    meta: [{ title: "Inbox | Aska" }],
  }),
  component: InboxPage,
  pendingComponent: MasonryGridSkeleton,
});

function InboxPage() {
  const { workspaceSlug } = Route.useParams();
  const filterScope = `inbox:${workspaceSlug}`;
  const filterBar = useSessionStore(
    (state) => state.filterBars[filterScope] ?? DEFAULT_FILTER_BAR_STATE,
  );
  const selectedAssetTypes =
    filterBar.filterType === "Type" ? (filterBar.selectedAssetTypes ?? []) : [];
  const {
    drawerNote,
    hasPreviousNote,
    openDrawer,
    promoteDrawer,
    goBack,
    closeDrawer,
    updateDrawerNote,
  } = usePersistedNoteDrawer(`aska.note-drawer:inbox:${workspaceSlug}`);
  const { viewerImage, openViewer, closeViewer } = usePersistedImageViewer(
    `aska.image-viewer:inbox:${workspaceSlug}`,
  );
  const {
    viewerVideo,
    openViewer: openVideoViewer,
    closeViewer: closeVideoViewer,
  } = usePersistedYouTubeVideoViewer(
    `aska.youtube-video-viewer:inbox:${workspaceSlug}`,
  );
  const [drawerColor, setDrawerColor] = useState<ColorAsset>();
  const [colorEditorOpen, setColorEditorOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<ColorAsset>();
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

  const handleOpenNote = (note: NoteAsset, _mode: "read" | "edit" = "read") => {
    openDrawer(note);
  };

  const handleCloseNote = () => closeDrawer();

  const handleOpenImage = (image: ImageAsset) => {
    openViewer(image);
  };

  const handleCloseImage = () => closeViewer();

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
          onOpenColor={setDrawerColor}
          onOpenVideo={openVideoViewer}
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
      <NoteDetailDrawer
        note={drawerNote}
        onNoteChange={updateDrawerNote}
        onPromote={promoteDrawer}
        onSwap={openDrawer}
        onBack={goBack}
        hasPreviousNote={hasPreviousNote}
        workspaceSlug={workspaceSlug}
        noteExtractionTarget={{ target: "inbox" }}
        onOpenReferencedColor={setDrawerColor}
        onClose={handleCloseNote}
      />
      <ColorDetailDrawer
        color={drawerColor}
        open={drawerColor !== undefined}
        workspaceSlug={workspaceSlug}
        scope={{ type: "inbox" }}
        onClose={() => setDrawerColor(undefined)}
        onOpenImage={handleOpenImage}
        onEdit={() => {
          setEditingColor(drawerColor);
          setColorEditorOpen(true);
        }}
      />
      <ColorEditorDialog
        workspaceSlug={workspaceSlug}
        target="inbox"
        color={editingColor}
        open={colorEditorOpen}
        onOpenChange={setColorEditorOpen}
      />
      <ImageAssetViewer
        asset={viewerImage}
        assets={displayAssets.filter(
          (asset): asset is ImageAsset => asset.type === "image",
        )}
        open={viewerImage !== undefined}
        workspaceSlug={workspaceSlug}
        onAssetChange={handleOpenImage}
        onOpenChange={(open) => {
          if (!open) handleCloseImage();
        }}
      />
      <YouTubeVideoViewer
        asset={viewerVideo}
        onClose={closeVideoViewer}
        workspaceSlug={workspaceSlug}
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
