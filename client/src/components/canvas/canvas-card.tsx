import "./canvas-card.css";

import { LoaderCircleIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { memo, useEffect, useMemo, useRef } from "react";
import { type Node, type NodeProps } from "@xyflow/react";

import type { CollectionNode } from "@/api/collection";
import { AssetContextMenu } from "@/components/board/asset-context-menu";
import { FolderAssetCard } from "@/components/board/cards/folder-asset-card";
import { ImageAssetCard } from "@/components/board/cards/image-asset-card";
import { NoteAssetCard } from "@/components/board/cards/note-asset-card";
import { LinkAssetCard } from "@/components/board/cards/link-asset-card";
import { VideoAssetCard } from "@/components/board/cards/video-asset-card";
import { ColorAssetCard } from "@/components/board/cards/color-asset-card";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { cn } from "@/lib/utils";
import { useTransientStore } from "@/store";
import type { LinkAsset, VideoAsset } from "@/types/asset";

import type { CanvasDropStackStyle } from "./canvas-drop-stack";

export type CanvasNodeData = {
  collectionNode: CollectionNode;
  boardKey: string;
  deleteContext: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
    expectedParentFolderNodeId: string | null;
  };
  onOpenFolder: (node: Extract<CollectionNode, { type: "folder" }>) => void;
  onOpenImage: (node: Extract<CollectionNode, { type: "image" }>) => void;
  onOpenColor: (node: Extract<CollectionNode, { type: "color" }>) => void;
  onOpenVideo: (asset: LinkAsset | VideoAsset) => void;
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
  presence?: "entering" | "exiting";
  onPresenceComplete: (
    nodeId: string,
    presence: "entering" | "exiting",
  ) => void;
  onExitStart: (nodeId: string) => void;
  onContextMenu: (id: string, event: React.MouseEvent) => void;
};

export type CanvasNode = Node<CanvasNodeData, "asset">;

function canvasCardPropsEqual(
  prev: NodeProps<CanvasNode>,
  next: NodeProps<CanvasNode>,
) {
  return (
    prev.data === next.data &&
    prev.dragging === next.dragging &&
    prev.selected === next.selected
  );
}

export const CanvasCard = memo(function CanvasCard({
  data,
  dragging,
  selected,
}: NodeProps<CanvasNode>) {
  const reduceMotion = useReducedMotion();
  const completedPresence = useRef<CanvasNodeData["presence"]>(undefined);
  const viewportActivity = useTransientStore(
    (state) => state.canvasViewportActivity[data.boardKey] ?? 0,
  );
  const node = data.collectionNode;
  const isEntering = data.presence === "entering";
  const isExiting = data.presence === "exiting";
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
    <div className="h-full min-w-0">
      {node.type === "image" && asset.type === "image" ? (
        <ImageAssetCard
          asset={asset}
          onOpen={isPending ? undefined : () => data.onOpenImage(node)}
          isContextMenuOpen={isContextMenuOpen}
          selected={selected}
        />
      ) : null}
      {node.type === "video" && asset.type === "video" ? (
        <VideoAssetCard
          asset={asset}
          onOpen={isPending ? undefined : () => data.onOpenVideo(asset)}
          isContextMenuOpen={isContextMenuOpen}
          selected={selected}
          dragging={dragging}
        />
      ) : null}
      {node.type === "note" && asset.type === "note" ? (
        <NoteAssetCard
          asset={asset}
          workspaceSlug={data.deleteContext.workspaceSlug}
          onOpen={isPending ? undefined : () => data.onOpenNote(node)}
          isContextMenuOpen={isContextMenuOpen}
          selected={selected}
        />
      ) : null}
      {node.type === "link" && asset.type === "link" ? (
        <LinkAssetCard
          asset={asset}
          onOpen={asset.video ? () => data.onOpenVideo(asset) : undefined}
          isContextMenuOpen={isContextMenuOpen}
          selected={selected}
        />
      ) : null}
      {node.type === "color" && displayAsset.type === "color" ? (
        <ColorAssetCard
          asset={displayAsset}
          onOpen={isPending ? undefined : () => data.onOpenColor(node)}
          isContextMenuOpen={isContextMenuOpen}
          selected={selected}
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
          selected={selected}
        />
      ) : null}
    </div>
  );

  useEffect(() => {
    if (data.presence) return;
    completedPresence.current = undefined;
  }, [data.presence]);

  useEffect(() => {
    if (!reduceMotion || !isExiting || completedPresence.current === "exiting")
      return;
    completedPresence.current = "exiting";
    data.onPresenceComplete(node.id, "exiting");
  }, [data, isExiting, node.id, reduceMotion]);

  return (
    <motion.div
      className={cn(
        "relative w-full rounded-lg transition-[filter,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        dragging && "drop-shadow-xl",
        isExiting && "pointer-events-none",
        data.isColorDimmed && "pointer-events-none opacity-30 saturate-50",
        data.isColorFocused && "outline-2 outline-primary outline-offset-2",
        node.type === "folder" &&
          data.isDropTarget &&
          "bg-accent/45 ring-2 ring-primary ring-offset-2 ring-offset-card",
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
      data-canvas-asset-id={
        !isPending && node.type !== "folder" ? node.id : undefined
      }
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
      <motion.div
        className={cn(isExiting && "pointer-events-none")}
        initial={
          reduceMotion || !isEntering ? false : { opacity: 0, scale: 0.98 }
        }
        animate={
          isExiting && !reduceMotion
            ? { opacity: 0, scale: 0.99 }
            : { opacity: 1, scale: 1 }
        }
        transition={{
          duration: reduceMotion ? 0 : isExiting ? 0.15 : 0.25,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ transformOrigin: "center" }}
        onAnimationComplete={() => {
          if (!data.presence || completedPresence.current === data.presence)
            return;
          completedPresence.current = data.presence;
          data.onPresenceComplete(node.id, data.presence);
        }}
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
            onOpenVideo={data.onOpenVideo}
            dismissVersion={viewportActivity}
            canvasBoardKey={data.boardKey}
            onBeforeDelete={() => data.onExitStart(node.id)}
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
            className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-card"
          />
        ) : null}
      </motion.div>
    </motion.div>
  );
}, canvasCardPropsEqual);

function isPendingCollectionNode(node: CollectionNode): boolean {
  return (
    (node.type === "image" && node.uploadStatus !== undefined) ||
    (node.type === "note" && node.id.startsWith("note-optimistic-")) ||
    (node.type === "link" && node.id.startsWith("link-optimistic-")) ||
    (node.type === "color" && node.id.startsWith("color-optimistic-")) ||
    (node.type === "folder" && node.flattenStatus === "pending")
  );
}
