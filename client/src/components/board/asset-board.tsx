import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

import { MasonryEmptyState } from "@/components/masonry-empty-state";
import type { Asset, ImageAsset, NoteAsset } from "@/types/asset";
import { AssetCard } from "./asset-card";
import { useMarqueeSelection } from "./use-marquee-selection";
import { SelectionActionBar } from "@/components/selection/selection-action-bar";
import {
  isPersistedSelectableAsset,
  isSelectionShortcut,
  isSelectionShortcutBlocked,
  selectionIdsForScope,
} from "@/lib/selection";
import { useTransientStore } from "@/store";
import { useBulkDelete } from "@/api/collection";

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
  const eligibleIds = useMemo(
    () =>
      new Set(
        assets.filter(isPersistedSelectableAsset).map((asset) => asset.id),
      ),
    [assets],
  );
  const selectedIds = scopeKey ? selectionIdsForScope(selection, scopeKey) : [];
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
    if (!scopeKey || selection.scopeKey !== scopeKey) return;
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
        replaceSelection(scopeKey, eligibleIds);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, eligibleIds, replaceSelection, scopeKey]);

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
      onPointerDownCapture={marquee.onPointerDownCapture}
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
            onDelete={handleBulkDelete}
          />
        </div>
      ) : null}
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
              isSelected={selectedIdSet.has(asset.id)}
              onToggleSelection={scopeKey ? toggleSelection : undefined}
              onSelectionContextMenu={
                scopeKey ? handleSelectionContextMenu : undefined
              }
              onOpenFolder={onOpenFolder}
              onOpenImage={onOpenImage}
              onOpenNote={onOpenNote}
            />
          ))}
        </div>
      )}
      {marquee.marquee ? (
        <div
          className="selection-marquee pointer-events-none fixed z-50"
          style={{
            left: marquee.marquee.left,
            top: marquee.marquee.top,
            width: marquee.marquee.right - marquee.marquee.left,
            height: marquee.marquee.bottom - marquee.marquee.top,
          }}
        />
      ) : null}
    </div>
  );
}
