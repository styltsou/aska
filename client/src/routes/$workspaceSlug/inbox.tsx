import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useInboxContents } from "@/api/collection";
import { AssetBoard } from "@/components/board/asset-board";
import { NoteDetailDrawer } from "@/components/board/note-detail-drawer";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { BoardContextMenu, BoardUploadZone } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { MasonryGridSkeleton } from "@/components/masonry-grid-skeleton";
import type { ImageAsset, NoteAsset } from "@/types/asset";
import { ImageAssetViewer } from "@/components/board/image-asset-viewer";

export const Route = createFileRoute("/$workspaceSlug/inbox")({
  validateSearch: (search: Record<string, unknown>) => ({
    note: typeof search.note === "string" ? search.note : undefined,
    image: typeof search.image === "string" ? search.image : undefined,
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
  const { data, isLoading, isError, error } = useInboxContents(workspaceSlug);

  if (isLoading) return <MasonryGridSkeleton />;

  if (isError) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unable to load Inbox"}
        </p>
      </div>
    );
  }

  const assets = data?.nodes.map(collectionNodeToAsset) ?? [];
  const selectedNote = selectedNoteId
    ? (assets.find(
        (a): a is NoteAsset => a.type === "note" && a.id === selectedNoteId,
      ) ?? undefined)
    : undefined;
  const selectedImage = selectedImageId
    ? (assets.find(
        (a): a is ImageAsset => a.type === "image" && a.id === selectedImageId,
      ) ?? undefined)
    : undefined;

  const handleOpenNote = (note: NoteAsset) => {
    void navigate({ search: (prev) => ({ ...prev, note: note.id }) });
  };

  const handleCloseNote = () => {
    void navigate({ search: (prev) => ({ ...prev, note: undefined }) });
  };

  const handleOpenImage = (image: ImageAsset) => {
    void navigate({ search: (prev) => ({ ...prev, image: image.id }) });
  };

  const handleCloseImage = () => {
    void navigate({ search: (prev) => ({ ...prev, image: undefined }) });
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
          assets={assets}
          inboxContext={{ workspaceSlug }}
          onOpenNote={handleOpenNote}
          onOpenImage={handleOpenImage}
          emptyTitle="Inbox is empty"
          emptyDescription="Quick captures and imports that are not in a collection yet will appear here."
        />
      </BoardUploadZone>
      <NoteDetailDrawer note={selectedNote} onClose={handleCloseNote} />
      <ImageAssetViewer
        asset={selectedImage}
        open={selectedImage !== undefined}
        onOpenChange={(open) => {
          if (!open) handleCloseImage();
        }}
      />
      {assets.length > 0 && <FilterBar />}
    </BoardContextMenu>
  );
}
