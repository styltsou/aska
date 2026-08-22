import { LoaderCircleIcon } from "lucide-react";
import { motion } from "motion/react";
import { memo, useMemo } from "react";
import type { Node, NodeProps } from "@xyflow/react";

import type { CollectionNode } from "@/api/collection";
import { AssetContextMenu } from "@/components/board/asset-context-menu";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { LinkAssetCard } from "@/components/board/cards/link-asset-card";
import { ColorAssetCard } from "@/components/board/cards/color-asset-card";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { cn } from "@/lib/utils";

import type { CanvasDropStackStyle } from "./canvas-drop-stack";

export type CanvasNodeData = {
  collectionNode: CollectionNode;
  deleteContext: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
    expectedParentFolderNodeId: string | null;
  };
  onOpenFolder: (node: Extract<CollectionNode, { type: "folder" }>) => void;
  onOpenImage: (node: Extract<CollectionNode, { type: "image" }>) => void;
  onOpenColor: (node: Extract<CollectionNode, { type: "color" }>) => void;
  onOpenNote: (
    node: Extract<CollectionNode, { type: "note" }>,
    mode?: "read" | "edit",
  ) => void;
  onCardClick: (id: string, event: React.MouseEvent) => void;
  suppressClick: (id: string) => boolean;
  isColorDimmed: boolean;
  isColorFocused: boolean;
  isDropTarget: boolean;
  incomingDropAssetId?: string;
  incomingDropCount?: number;
  dropStackStyle?: CanvasDropStackStyle;
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
  const dropStackStyle = data.dropStackStyle;
  const stackAnimation = useMemo(
    () =>
      dropStackStyle
        ? {
            x: dropStackStyle.translateX,
            y: dropStackStyle.translateY,
            rotate: dropStackStyle.rotation,
            scale: dropStackStyle.scale,
          }
        : { x: 0, y: 0, rotate: 0, scale: 1 },
    [dropStackStyle],
  );

  const card = (isContextMenuOpen = false, displayAsset = asset) => (
    <div className="min-w-0">
      {node.type === "image" && asset.type === "image" ? (
        <ImageAssetCard
          asset={asset}
          onOpen={isPending ? undefined : () => data.onOpenImage(node)}
          isContextMenuOpen={isContextMenuOpen}
        />
      ) : null}
      {node.type === "note" && asset.type === "note" ? (
        <NoteAssetCard
          asset={asset}
          onOpen={isPending ? undefined : () => data.onOpenNote(node)}
          isContextMenuOpen={isContextMenuOpen}
        />
      ) : null}
      {node.type === "link" && asset.type === "link" ? (
        <LinkAssetCard asset={asset} isContextMenuOpen={isContextMenuOpen} />
      ) : null}
      {node.type === "color" && displayAsset.type === "color" ? (
        <ColorAssetCard
          asset={displayAsset}
          onOpen={isPending ? undefined : () => data.onOpenColor(node)}
          isContextMenuOpen={isContextMenuOpen}
        />
      ) : null}
      {node.type === "folder" && asset.type === "folder" ? (
        <FolderAssetCard
          asset={asset}
          incomingAssetId={data.incomingDropAssetId}
          incomingAssetCount={data.incomingDropCount}
          isDropTarget={data.isDropTarget}
          onOpen={() => data.onOpenFolder(node)}
          isContextMenuOpen={isContextMenuOpen}
        />
      ) : null}
    </div>
  );

  return (
    <motion.div
      className={cn(
        "relative w-full rounded-lg transition-[filter,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        dragging && "drop-shadow-xl",
        data.isColorDimmed && "pointer-events-none opacity-30 saturate-50",
        data.isColorFocused && "outline-2 outline-primary outline-offset-2",
        node.type === "folder" &&
          data.isDropTarget &&
          "bg-accent/45 ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      animate={stackAnimation}
      transition={{
        type: "tween",
        duration: 0.12,
        ease: [0.22, 1, 0.36, 1],
        delay: dropStackStyle ? dropStackStyle.delayMs / 1000 : 0,
      }}
      style={{ transformOrigin: "bottom center" }}
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
        card()
      ) : (
        <AssetContextMenu
          asset={asset}
          deleteContext={data.deleteContext}
          onOpenImage={
            node.type === "image" ? () => data.onOpenImage(node) : undefined
          }
          onEditNote={
            node.type === "note"
              ? () => data.onOpenNote(node, "edit")
              : undefined
          }
        >
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
      ) : node.type === "folder" && node.flattenStatus === "pending" ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-2.5 pb-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-popover/85 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-sm ring-1 ring-border backdrop-blur-sm">
            <LoaderCircleIcon className="size-3 animate-spin" />
            <span>Flattening…</span>
          </div>
        </div>
      ) : null}
      {selected ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background"
        />
      ) : null}
    </motion.div>
  );
});

function isPendingCollectionNode(node: CollectionNode): boolean {
  return (
    (node.type === "image" && node.uploadStatus !== undefined) ||
    (node.type === "note" && node.id.startsWith("note-optimistic-")) ||
    (node.type === "link" && node.id.startsWith("link-optimistic-")) ||
    (node.type === "color" && node.id.startsWith("color-optimistic-")) ||
    (node.type === "folder" && node.flattenStatus === "pending")
  );
}
