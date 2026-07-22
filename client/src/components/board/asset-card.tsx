import { memo } from "react";
import type { MouseEvent } from "react";
import type { Asset, FolderAsset, ImageAsset, NoteAsset } from "@/types/asset";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { AssetContextMenu } from "./asset-context-menu";
import {
  hasSelectionModifier,
  isPersistedSelectableAsset,
} from "@/lib/selection";
import { cn } from "@/lib/utils";

export const AssetCard = memo(function AssetCard({
  asset,
  onOpenFolder,
  onOpenImage,
  onOpenNote,
  deleteContext,
  inboxContext,
  isSelected = false,
  onToggleSelection,
  onSelectionContextMenu,
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
  isSelected?: boolean;
  onToggleSelection?: (assetId: string) => void;
  onSelectionContextMenu?: (
    assetId: string,
    event: MouseEvent<HTMLDivElement>,
  ) => void;
}) {
  const selectable = isPersistedSelectableAsset(asset);

  return (
    <div
      className={cn(
        "min-w-0 rounded-lg",
        isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
      data-selection-node-id={selectable ? asset.id : undefined}
      aria-selected={selectable ? isSelected : undefined}
      onClick={(event) => {
        if (!selectable || !hasSelectionModifier(event)) return;
        event.preventDefault();
        event.stopPropagation();
        onToggleSelection?.(asset.id);
      }}
      onContextMenuCapture={(event) => {
        if (!selectable) return;
        onSelectionContextMenu?.(asset.id, event);
      }}
    >
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
});
