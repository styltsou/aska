import type { Asset } from "@/types/asset";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { AssetContextMenu } from "./asset-context-menu";

import { useDraggable } from "@dnd-kit/react";

export function AssetCard({ asset }: { asset: Asset }) {
  const { ref } = useDraggable({ id: asset.id });

  return (
    <div ref={ref}>
      <AssetContextMenu asset={asset}>
        {asset.type === "image" && <ImageAssetCard asset={asset} />}
        {asset.type === "note" && <NoteAssetCard asset={asset} />}
        {asset.type === "folder" && <FolderAssetCard asset={asset} />}
      </AssetContextMenu>
    </div>
  );
}
