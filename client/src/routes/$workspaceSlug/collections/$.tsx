import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderPlusIcon, UploadIcon } from "lucide-react";

import { useCollectionContents } from "@/api/collection";
import { AssetBoard } from "@/components/board/asset-board";
import { NoteDetailDrawer } from "@/components/board/note-detail-drawer";
import { CreateFolderDialog } from "@/components/app-shell/create-folder-dialog";
import { UploadImagesDialog } from "@/components/app-shell/upload-images-dialog";
import { BoardContextMenu, BoardUploadZone } from "@/components/board";
import { FilterBar } from "@/components/filter-bar";
import { Button } from "@/components/ui/button";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { MasonryGridSkeleton } from "@/components/masonry-grid-skeleton";
import type { ImageAsset, NoteAsset } from "@/types/asset";
import { ImageAssetViewer } from "@/components/board/image-asset-viewer";

export const Route = createFileRoute("/$workspaceSlug/collections/$")({
  validateSearch: (search: Record<string, unknown>) => ({
    note: typeof search.note === "string" ? search.note : undefined,
    image: typeof search.image === "string" ? search.image : undefined,
  }),
  component: CollectionPage,
  pendingComponent: MasonryGridSkeleton,
});

function CollectionPage() {
  const { workspaceSlug, _splat } = Route.useParams();
  const search = Route.useSearch();
  const selectedNoteId = search.note;
  const selectedImageId = search.image;
  const navigate = useNavigate({ from: Route.fullPath });
  const collectionPath = _splat ?? "";
  const [collectionSlug = "", ...folderSegments] = collectionPath
    .split("/")
    .filter(Boolean);
  const folderPath = folderSegments.join("/");
  const { data, isLoading, isError, error } = useCollectionContents(
    workspaceSlug,
    collectionSlug,
    folderPath || undefined,
  );

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  if (isLoading) return <MasonryGridSkeleton />;

  if (isError) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Unable to load collection"}
        </p>
      </div>
    );
  }

  const assets = data?.nodes.map(collectionNodeToAsset) ?? [];
  const parentFolderPath = folderPath || undefined;
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
    <>
      <BoardContextMenu
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
      >
        <BoardUploadZone
          workspaceSlug={workspaceSlug}
          collectionPath={collectionPath}
        >
          <AssetBoard
            assets={assets}
            deleteContext={{
              workspaceSlug,
              collectionSlug,
              folderPath: parentFolderPath,
            }}
            emptyTitle={folderPath ? "Folder is empty" : "Collection is empty"}
            emptyDescription={
              folderPath
                ? "Anything added to this folder will appear here in the masonry board."
                : "Anything added to this collection will appear here in the masonry board."
            }
            emptyStateChildren={
              assets.length === 0 ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setFolderDialogOpen(true)}
                  >
                    <FolderPlusIcon />
                    <span>New folder</span>
                  </Button>
                  <Button onClick={() => setUploadDialogOpen(true)}>
                    <UploadIcon />
                    <span>Upload</span>
                  </Button>
                </>
              ) : undefined
            }
            onOpenNote={handleOpenNote}
            onOpenImage={handleOpenImage}
            onOpenFolder={(folder) => {
              void navigate({
                to: "/$workspaceSlug/collections/$",
                params: {
                  workspaceSlug,
                  _splat: `${collectionPath}/${folder.slug}`,
                },
                search: { note: undefined, image: undefined },
              });
            }}
          />
        </BoardUploadZone>
      </BoardContextMenu>
      <NoteDetailDrawer
        note={selectedNote}
        noteExtractionTarget={{
          workspaceSlug,
          collectionSlug,
          parentFolderPath,
        }}
        onClose={handleCloseNote}
      />
      <ImageAssetViewer
        asset={selectedImage}
        open={selectedImage !== undefined}
        onOpenChange={(open) => {
          if (!open) handleCloseImage();
        }}
      />
      {assets.length > 0 && <FilterBar />}
      <CreateFolderDialog
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
      />
      <UploadImagesDialog
        workspaceSlug={workspaceSlug}
        collectionPath={collectionPath}
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />
    </>
  );
}
