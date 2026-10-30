import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { MasonryEmptyState } from "@/components/masonry-empty-state";
import { Masonry } from "@/components/masonry-grid";
import { VirtualMasonry } from "@/components/virtual-masonry";
import type { GridDensity } from "@/components/grid-density";
import type { Asset, ColorAsset, ImageAsset, NoteAsset } from "@/types/asset";
import { AssetCard } from "./asset-card";
import {
  selectionMarqueeClassName,
  useMarqueeSelection,
} from "./use-marquee-selection";
import { SelectionActionBar } from "@/components/selection/selection-action-bar";
import {
  isPersistedSelectableAsset,
  isSelectionShortcut,
  isSelectionShortcutBlocked,
  selectionIdsForScope,
} from "@/lib/selection";
import { useTransientStore } from "@/store";
import { useBulkDelete } from "@/api/collection";
import { MoveToDialog } from "@/components/move-to-dialog";
import { useIsomorphicLayoutEffect } from "@/hooks/use-isomorphic-layout-effect";

type CollectionDeleteContext = {
  workspaceSlug: string;
  collectionSlug: string;
  folderPath?: string;
  expectedParentFolderNodeId: string | null;
};

type InboxContext = {
  workspaceSlug: string;
};

const EMPTY_SELECTED_IDS: string[] = [];

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
  onOpenColor,
  onOpenVideo,
  focusedAssetId,
  focusRequestId,
  onDismissFocusedAsset,
  density,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onSelectAll,
}: {
  assets: Asset[];
  emptyTitle: string;
  emptyDescription: string;
  emptyStateChildren?: ReactNode;
  deleteContext?: CollectionDeleteContext;
  inboxContext?: InboxContext;
  onOpenFolder?: (asset: Extract<Asset, { type: "folder" }>) => void;
  onOpenNote?: (note: NoteAsset, mode?: "read" | "edit") => void;
  onOpenImage?: (image: ImageAsset) => void;
  onOpenColor?: (color: ColorAsset) => void;
  onOpenVideo?: (video: Extract<Asset, { type: "link" | "video" }>) => void;
  focusedAssetId?: string;
  focusRequestId?: number;
  onDismissFocusedAsset?: () => void;
  density?: GridDensity;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onSelectAll?: () => Promise<string[]>;
}) {
  const scopeKey = inboxContext
    ? `inbox:${inboxContext.workspaceSlug}`
    : undefined;
  const selection = useTransientStore((state) => state.selection);
  const activateSelectionScope = useTransientStore(
    (state) => state.activateSelectionScope,
  );
  const replaceSelection = useTransientStore((state) => state.replaceSelection);
  const toggleSelectedNode = useTransientStore(
    (state) => state.toggleSelectedNode,
  );
  const clearSelection = useTransientStore((state) => state.clearSelection);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadMoreInFlightRef = useRef(false);
  const [contentWidth, setContentWidth] = useState(0);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const eligibleIds = useMemo(
    () =>
      new Set(
        assets.filter(isPersistedSelectableAsset).map((asset) => asset.id),
      ),
    [assets],
  );
  const selectedIds = scopeKey
    ? selectionIdsForScope(selection, scopeKey)
    : EMPTY_SELECTED_IDS;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectionRef = useRef({ selectedIds: selectedIdSet, count: 0 });
  selectionRef.current = {
    selectedIds: selectedIdSet,
    count: selectedIds.length,
  };
  const toggleSelection = useCallback(
    (assetId: string) => {
      if (scopeKey) toggleSelectedNode(scopeKey, assetId);
    },
    [scopeKey, toggleSelectedNode],
  );
  const handleSelectionContextMenu = useCallback(
    (assetId: string, event: MouseEvent<HTMLDivElement>) => {
      if (!scopeKey) return;
      const { selectedIds, count } = selectionRef.current;
      if (selectedIds.has(assetId) && count > 1) {
        event.preventDefault();
        event.stopPropagation();
      } else if (!selectedIds.has(assetId) && count > 0) {
        clearSelection(scopeKey);
      }
    },
    [clearSelection, scopeKey],
  );
  const marquee = useMarqueeSelection({
    surfaceRef,
    eligibleNodeIds: eligibleIds,
    onReplace: (nodeIds) => {
      if (scopeKey) replaceSelection(scopeKey, nodeIds);
    },
  });

  useEffect(() => {
    if (!scopeKey) return;
    activateSelectionScope(scopeKey);
  }, [activateSelectionScope, scopeKey]);

  useEffect(() => {
    if (
      !focusedAssetId ||
      !assets.some((asset) => asset.id === focusedAssetId)
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      surfaceRef.current
        ?.querySelector(`[data-selection-node-id="${focusedAssetId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [assets, focusedAssetId, focusRequestId]);

  useIsomorphicLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const viewport = surface.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!viewport) return;
    scrollRef.current = viewport as HTMLDivElement;
    const updateWidth = () => setContentWidth(surface.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(surface);
    return () => {
      observer.disconnect();
      scrollRef.current = null;
    };
  }, [inboxContext]);

  useEffect(() => {
    if (!isLoadingMore) loadMoreInFlightRef.current = false;
  }, [isLoadingMore]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = loadMoreRef.current;
    if (!root || !sentinel || !hasMore || !onLoadMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry?.isIntersecting &&
          !isLoadingMore &&
          !loadMoreInFlightRef.current
        ) {
          loadMoreInFlightRef.current = true;
          onLoadMore();
        }
      },
      { root, rootMargin: "900px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [assets.length, hasMore, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (
      !scopeKey ||
      selection.scopeKey !== scopeKey ||
      (inboxContext && hasMore)
    )
      return;
    replaceSelection(
      scopeKey,
      selectedIds.filter((nodeId) => eligibleIds.has(nodeId)),
    );
  }, [
    eligibleIds,
    replaceSelection,
    scopeKey,
    selectedIds,
    selection.scopeKey,
    inboxContext,
    hasMore,
  ]);

  useEffect(() => {
    if (!scopeKey) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isSelectionShortcutBlocked(event.target)) return;
      if (event.key === "Escape") {
        clearSelection(scopeKey);
        return;
      }
      if (isSelectionShortcut(event)) {
        event.preventDefault();
        if (onSelectAll) {
          void onSelectAll()
            .then((nodeIds) => replaceSelection(scopeKey, nodeIds))
            .catch(() => undefined);
        } else {
          replaceSelection(scopeKey, eligibleIds);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, eligibleIds, onSelectAll, replaceSelection, scopeKey]);

  const bulkDelete = useBulkDelete(inboxContext?.workspaceSlug ?? "");
  const handleBulkDelete = useCallback(() => {
    bulkDelete.mutate(
      { nodeIds: selectedIds },
      {
        onSuccess: () => {
          if (scopeKey) clearSelection(scopeKey);
        },
      },
    );
  }, [bulkDelete, clearSelection, scopeKey, selectedIds]);

  return (
    <div
      ref={surfaceRef}
      className="relative min-h-0"
      onPointerDownCapture={(event) => {
        if (focusRequestId !== undefined) onDismissFocusedAsset?.();
        marquee.onPointerDownCapture(event);
      }}
      onPointerMoveCapture={marquee.onPointerMoveCapture}
      onPointerUpCapture={marquee.onPointerUpCapture}
      onPointerCancelCapture={marquee.onPointerCancelCapture}
      onClickCapture={(event) => {
        marquee.consumeClick(event);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && scopeKey)
          clearSelection(scopeKey);
      }}
      onContextMenuCapture={(event) => {
        if (event.target === event.currentTarget && scopeKey)
          clearSelection(scopeKey);
      }}
    >
      {scopeKey ? (
        <div className="pointer-events-auto absolute top-2 left-1/2 z-20 -translate-x-1/2">
          <SelectionActionBar
            count={selectedIds.length}
            surface="inbox"
            onClear={() => clearSelection(scopeKey)}
            onMove={() => setMoveDialogOpen(true)}
            onDelete={handleBulkDelete}
          />
        </div>
      ) : null}
      {assets.length === 0 ? (
        <MasonryEmptyState title={emptyTitle} description={emptyDescription}>
          {emptyStateChildren}
        </MasonryEmptyState>
      ) : inboxContext && density && contentWidth > 0 && scrollRef.current ? (
        <>
          <VirtualMasonry
            width={contentWidth}
            density={density}
            scrollElementRef={scrollRef}
            focusedIndex={
              focusedAssetId
                ? assets.findIndex((asset) => asset.id === focusedAssetId)
                : undefined
            }
            focusRequestId={focusRequestId}
          >
            {assets.map((asset) => renderAssetCard(asset))}
          </VirtualMasonry>
          <div ref={loadMoreRef} className="h-px" aria-hidden="true" />
          {isLoadingMore ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              Loading more…
            </div>
          ) : null}
        </>
      ) : (
        <Masonry className="min-w-0">
          {assets.map((asset) => renderAssetCard(asset))}
        </Masonry>
      )}
      {marquee.marquee ? (
        <div
          className={selectionMarqueeClassName}
          style={{
            left: marquee.marquee.left,
            top: marquee.marquee.top,
            width: marquee.marquee.right - marquee.marquee.left,
            height: marquee.marquee.bottom - marquee.marquee.top,
          }}
        />
      ) : null}
      {inboxContext ? (
        <MoveToDialog
          open={moveDialogOpen && selectedIds.length > 0}
          onOpenChange={setMoveDialogOpen}
          source={{
            workspaceSlug: inboxContext.workspaceSlug,
            nodeIds: selectedIds,
          }}
          onMoved={(movedIds) => {
            if (!scopeKey) return;
            const movedIdSet = new Set(movedIds);
            replaceSelection(
              scopeKey,
              selectedIds.filter((id) => !movedIdSet.has(id)),
            );
          }}
        />
      ) : null}
    </div>
  );

  function renderAssetCard(asset: Asset) {
    return (
      <AssetCard
        key={
          asset.type === "image" || asset.type === "link"
            ? (asset.clientId ?? asset.id)
            : asset.id
        }
        asset={asset}
        isFocused={focusedAssetId === asset.id}
        deleteContext={deleteContext}
        inboxContext={inboxContext}
        isSelected={selectedIdSet.has(asset.id)}
        onToggleSelection={scopeKey ? toggleSelection : undefined}
        onSelectionContextMenu={
          scopeKey ? handleSelectionContextMenu : undefined
        }
        onOpenFolder={onOpenFolder}
        onOpenImage={onOpenImage}
        onOpenNote={onOpenNote}
        onOpenColor={onOpenColor}
        onOpenVideo={onOpenVideo}
      />
    );
  }
}
