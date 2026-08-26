import { memo } from "react";
import type { MouseEvent } from "react";
import type {
  Asset,
  ColorAsset,
  FolderAsset,
  ImageAsset,
  NoteAsset,
} from "@/types/asset";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { LinkAssetCard } from "@/components/board/cards/link-asset-card";
import { ColorAssetCard } from "@/components/board/cards/color-asset-card";
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
  onOpenColor,
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
  onOpenNote?: (asset: NoteAsset, mode?: "read" | "edit") => void;
  onOpenColor?: (asset: ColorAsset) => void;
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
      >
        {(isContextMenuOpen, displayAsset) => (
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
                workspaceSlug={
                  deleteContext?.workspaceSlug ?? inboxContext?.workspaceSlug
                }
                onOpen={
                  onOpenNote ? () => onOpenNote(asset, "read") : undefined
                }
                isContextMenuOpen={isContextMenuOpen}
              />
            )}
            {asset.type === "link" && (
              <LinkAssetCard
                asset={asset}
                isContextMenuOpen={isContextMenuOpen}
              />
            )}
            {displayAsset.type === "color" && (
              <ColorAssetCard
                asset={displayAsset}
                onOpen={
                  onOpenColor ? () => onOpenColor(displayAsset) : undefined
                }
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
