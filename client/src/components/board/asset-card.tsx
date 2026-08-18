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
  folderDropState,
}: {
  asset: Asset;
  onOpenFolder?: (asset: FolderAsset) => void;
  onOpenImage?: (asset: ImageAsset) => void;
  onOpenNote?: (asset: NoteAsset) => void;
  deleteContext?: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
    expectedParentFolderNodeId: string | null;
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
  folderDropState?: {
    isDropTarget: boolean;
    incomingAssetId?: string;
    incomingAssetCount?: number;
  };
}) {
  const selectable = isPersistedSelectableAsset(asset);

  return (
    <div
      className={cn("relative min-w-0 rounded-lg")}
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
        onOpenImage={
          asset.type === "image" && onOpenImage
            ? () => onOpenImage(asset)
            : undefined
        }
      >
        {(isContextMenuOpen) => (
          <>
            {asset.type === "image" && (
              <ImageAssetCard
                asset={asset}
                onOpen={onOpenImage ? () => onOpenImage(asset) : undefined}
                isContextMenuOpen={isContextMenuOpen}
              />
            )}
            {asset.type === "note" && (
              <NoteAssetCard
                asset={asset}
                onOpen={onOpenNote ? () => onOpenNote(asset) : undefined}
                isContextMenuOpen={isContextMenuOpen}
              />
            )}
            {asset.type === "folder" && (
              <FolderAssetCard
                asset={asset}
                isDropTarget={folderDropState?.isDropTarget}
                incomingAssetId={folderDropState?.incomingAssetId}
                incomingAssetCount={folderDropState?.incomingAssetCount}
                onOpen={onOpenFolder ? () => onOpenFolder(asset) : undefined}
                isContextMenuOpen={isContextMenuOpen}
              />
            )}
          </>
        )}
      </AssetContextMenu>
      {isSelected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
        />
      ) : null}
    </div>
  );
});
