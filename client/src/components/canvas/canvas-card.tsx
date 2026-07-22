import { LoaderCircleIcon } from "lucide-react";
import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";

import type { CollectionNode } from "@/api/collection";
import { AssetContextMenu } from "@/components/board/asset-context-menu";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { cn } from "@/lib/utils";

export type CanvasNodeData = {
  collectionNode: CollectionNode;
  deleteContext: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
  };
  onOpenFolder: (node: Extract<CollectionNode, { type: "folder" }>) => void;
  onOpenImage: (node: Extract<CollectionNode, { type: "image" }>) => void;
  onOpenNote: (node: Extract<CollectionNode, { type: "note" }>) => void;
  onCardClick: (id: string, event: React.MouseEvent) => void;
  suppressClick: (id: string) => boolean;
  isColorDimmed: boolean;
  isColorFocused: boolean;
  isDropTarget: boolean;
  incomingDropAssetId?: string;
  onContextMenu: (id: string, event: React.MouseEvent) => void;
};

export type CanvasNode = Node<CanvasNodeData, "asset">;

export const CanvasCard = memo(function CanvasCard({
  data,
  dragging,
  selected,
}: NodeProps<CanvasNode>) {
  const node = data.collectionNode;
  const asset = collectionNodeToAsset(node);
  const isPending = isPendingCollectionNode(node);

  const card = (
    <div className="min-w-0">
      {node.type === "image" && asset.type === "image" ? (
        <ImageAssetCard
          asset={asset}
          onOpen={isPending ? undefined : () => data.onOpenImage(node)}
        />
      ) : null}
      {node.type === "note" && asset.type === "note" ? (
        <NoteAssetCard
          asset={asset}
          onOpen={isPending ? undefined : () => data.onOpenNote(node)}
        />
      ) : null}
      {node.type === "folder" && asset.type === "folder" ? (
        <FolderAssetCard
          asset={asset}
          incomingAssetId={data.incomingDropAssetId}
          isDropTarget={data.isDropTarget}
          onOpen={() => data.onOpenFolder(node)}
        />
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "relative w-full rounded-lg transition-[filter,opacity] duration-100",
        dragging && "drop-shadow-xl",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        data.isColorDimmed && "pointer-events-none opacity-30 saturate-50",
        data.isColorFocused && "outline-2 outline-primary outline-offset-2",
        node.type === "folder" &&
          data.isDropTarget &&
          "bg-accent/45 ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      aria-busy={isPending || undefined}
      data-selection-node-id={
        !isPending && !data.isColorDimmed ? node.id : undefined
      }
      onClickCapture={(event) => {
        // Base UI renders menus and dialogs in portals. Their events still
        // traverse this React tree, but stopping them during capture prevents
        // the portaled menu item itself from receiving the click. The bubble
        // handler below stops those events after the action has run.
        if (
          event.target instanceof Node &&
          !event.currentTarget.contains(event.target)
        ) {
          return;
        }
        if (data.suppressClick(node.id)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onClick={(event) => {
        if (
          event.target instanceof Node &&
          !event.currentTarget.contains(event.target)
        ) {
          event.stopPropagation();
          return;
        }
        data.onCardClick(node.id, event);
      }}
      onContextMenuCapture={(event) => data.onContextMenu(node.id, event)}
    >
      {isPending ? (
        card
      ) : (
        <AssetContextMenu asset={asset} deleteContext={data.deleteContext}>
          {card}
        </AssetContextMenu>
      )}
      {node.type === "note" && isPending ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-popover/85 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
            <LoaderCircleIcon className="size-3 animate-spin" />
            <span>Saving</span>
          </div>
        </div>
      ) : null}
    </div>
  );
});

function isPendingCollectionNode(node: CollectionNode): boolean {
  return (
    (node.type === "image" && node.uploadStatus !== undefined) ||
    (node.type === "note" && node.id.startsWith("note-optimistic-"))
  );
}
