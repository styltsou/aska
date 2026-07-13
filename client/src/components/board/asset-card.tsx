import type { Asset, FolderAsset, ImageAsset, NoteAsset } from "@/types/asset";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { AssetContextMenu } from "./asset-context-menu";

import { useDraggable } from "@dnd-kit/react";

export function AssetCard({
  asset,
  onOpenFolder,
  onOpenImage,
  onOpenNote,
  deleteContext,
  inboxContext,
}: {
  asset: Asset;
  onOpenFolder?: (asset: FolderAsset) => void;
  onOpenImage?: (asset: ImageAsset) => void;
  onOpenNote?: (asset: NoteAsset) => void;
  deleteContext?: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
  };
  inboxContext?: {
    workspaceSlug: string;
  };
}) {
  const { ref } = useDraggable({ id: asset.id });

  return (
    <div ref={ref} className="min-w-0">
      <AssetContextMenu
        asset={asset}
        deleteContext={deleteContext}
        inboxContext={inboxContext}
      >
        {asset.type === "image" && (
          <ImageAssetCard
            asset={asset}
            onOpen={onOpenImage ? () => onOpenImage(asset) : undefined}
          />
        )}
        {asset.type === "note" && (
          <NoteAssetCard
            asset={asset}
            onOpen={onOpenNote ? () => onOpenNote(asset) : undefined}
          />
        )}
        {asset.type === "folder" && (
          <FolderAssetCard
            asset={asset}
            onOpen={onOpenFolder ? () => onOpenFolder(asset) : undefined}
          />
        )}
      </AssetContextMenu>
    </div>
  );
}
