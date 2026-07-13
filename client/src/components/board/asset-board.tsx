import type { ReactNode } from "react";

import { MasonryEmptyState } from "@/components/masonry-empty-state";
import type { Asset, ImageAsset, NoteAsset } from "@/types/asset";
import { AssetCard } from "./asset-card";

type CollectionDeleteContext = {
  workspaceSlug: string;
  collectionSlug: string;
  folderPath?: string;
};

type InboxContext = {
  workspaceSlug: string;
};

export function AssetBoard({
  assets,
  emptyTitle,
  emptyDescription,
  emptyStateChildren,
  deleteContext,
  inboxContext,
  onOpenFolder,
  onOpenNote,
  onOpenImage,
}: {
  assets: Asset[];
  emptyTitle: string;
  emptyDescription: string;
  emptyStateChildren?: ReactNode;
  deleteContext?: CollectionDeleteContext;
  inboxContext?: InboxContext;
  onOpenFolder?: (asset: Extract<Asset, { type: "folder" }>) => void;
  onOpenNote?: (note: NoteAsset) => void;
  onOpenImage?: (image: ImageAsset) => void;
}) {
  return (
    <>
      {assets.length === 0 ? (
        <MasonryEmptyState title={emptyTitle} description={emptyDescription}>
          {emptyStateChildren}
        </MasonryEmptyState>
      ) : (
        <div className="min-w-0 columns-6 gap-2.5 *:mb-2.5 *:break-inside-avoid max-md:columns-4 max-sm:columns-2">
          {assets.map((asset) => (
            <AssetCard
              key={
                asset.type === "image" ? (asset.clientId ?? asset.id) : asset.id
              }
              asset={asset}
              deleteContext={deleteContext}
              inboxContext={inboxContext}
              onOpenFolder={asset.type === "folder" ? onOpenFolder : undefined}
              onOpenImage={onOpenImage}
              onOpenNote={onOpenNote}
            />
          ))}
        </div>
      )}
    </>
  );
}
