import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  DragOverlay,
  useDragDropMonitor,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";

import {
  useBulkDelete,
  useMoveCollectionNodesToFolder,
  type CollectionNode,
} from "@/api/collection";
import { AssetCard } from "@/components/board/asset-card";
import { useMarqueeSelection } from "@/components/board/use-marquee-selection";
import { SelectionActionBar } from "@/components/selection/selection-action-bar";
import { MoveToDialog } from "@/components/move-to-dialog";
import { Masonry } from "@/components/masonry-grid";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collectionNodeToAsset } from "@/lib/asset-transform";
import { sortCollectionNodesByMostRecent } from "@/lib/collection-node-order";
import {
  isPersistedSelectableAsset,
  isSelectionShortcut,
  isSelectionShortcutBlocked,
  selectionIdsForScope,
} from "@/lib/selection";
import { cn } from "@/lib/utils";
import { useTransientStore } from "@/store";

const ASSET_PAGE_SIZE = 40;
const BROWSE_NODE_DRAG_TYPE = "browse-node";
const BROWSE_FOLDER_DROP_PREFIX = "browse-folder:";

type BrowseNodeDragData = {
  primaryNodeId: string;
  nodeIds: string[];
};

type PendingFolderDrop = BrowseNodeDragData & {
  targetFolderNodeId: string;
};

type CollectionBrowseViewProps = {
  boardKey: string;
  workspaceSlug: string;
  collectionSlug: string;
  folderPath?: string;
  expectedParentFolderNodeId: string | null;
  nodes: CollectionNode[];
  isColorFilterActive?: boolean;
  colorMatchNodeIds?: ReadonlySet<string>;
  focusedNodeId?: string;
  loadError?: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  onOpenFolder: (node: Extract<CollectionNode, { type: "folder" }>) => void;
  onOpenImage: (node: Extract<CollectionNode, { type: "image" }>) => void;
  onOpenNote: (
    node: Extract<CollectionNode, { type: "note" }>,
    mode?: "read" | "edit",
  ) => void;
};

export function CollectionBrowseView({
  boardKey,
  workspaceSlug,
  collectionSlug,
  folderPath,
  expectedParentFolderNodeId,
  nodes,
  isColorFilterActive = false,
  colorMatchNodeIds,
  focusedNodeId,
  loadError,
  emptyTitle,
  emptyDescription,
  onOpenFolder,
  onOpenImage,
  onOpenNote,
}: CollectionBrowseViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [visibleAssetCount, setVisibleAssetCount] = useState(ASSET_PAGE_SIZE);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<BrowseNodeDragData>();
  const [pendingFolderDrop, setPendingFolderDrop] =
    useState<PendingFolderDrop>();
  const dropTargetRectRef = useRef<DOMRect | undefined>(undefined);
  const selection = useTransientStore((state) => state.selection);
  const activateSelectionScope = useTransientStore(
    (state) => state.activateSelectionScope,
  );
  const replaceSelection = useTransientStore((state) => state.replaceSelection);
  const toggleSelectedNode = useTransientStore(
    (state) => state.toggleSelectedNode,
  );
  const clearSelection = useTransientStore((state) => state.clearSelection);
  const bulkDelete = useBulkDelete(workspaceSlug);
  const moveNodesToFolder = useMoveCollectionNodesToFolder(
    workspaceSlug,
    collectionSlug,
  );

  const orderedNodes = useMemo(
    () => sortCollectionNodesByMostRecent(nodes),
    [nodes],
  );
  const nodeById = useMemo(
    () => new Map(orderedNodes.map((node) => [node.id, node])),
    [orderedNodes],
  );
  const folders = useMemo(
    () => orderedNodes.filter(isFolderNode),
    [orderedNodes],
  );
  const assets = useMemo(
    () =>
      orderedNodes.filter(
        (node): node is Exclude<CollectionNode, { type: "folder" }> =>
          node.type !== "folder" &&
          (!isColorFilterActive || colorMatchNodeIds?.has(node.id) === true),
      ),
    [colorMatchNodeIds, isColorFilterActive, orderedNodes],
  );
  const visibleAssets = assets.slice(0, visibleAssetCount);
  const hasMoreAssets = visibleAssetCount < assets.length;
  const eligibleNodeIds = useMemo(
    () =>
      new Set(
        [...folders, ...assets]
          .filter(isPersistedSelectableAsset)
          .map((node) => node.id),
      ),
    [assets, folders],
  );
  const selectedIds = selectionIdsForScope(selection, boardKey);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectionRef = useRef({ selectedIds: selectedIdSet, count: 0 });
  selectionRef.current = {
    selectedIds: selectedIdSet,
    count: selectedIds.length,
  };
  const marquee = useMarqueeSelection({
    surfaceRef,
    eligibleNodeIds,
    onReplace: (nodeIds) => replaceSelection(boardKey, nodeIds),
    shouldStart: (event) =>
      !(event.target instanceof Element) ||
      !event.target.closest("[data-selection-node-id]"),
  });

  useDragDropMonitor({
    onDragStart(event) {
      if (event.operation.source?.type !== BROWSE_NODE_DRAG_TYPE) return;
      setActiveDrag(event.operation.source.data as BrowseNodeDragData);
    },
    onDragEnd(event) {
      const { operation } = event;
      setActiveDrag(undefined);
      if (
        event.canceled ||
        operation.source?.type !== BROWSE_NODE_DRAG_TYPE ||
        typeof operation.target?.id !== "string" ||
        !operation.target.id.startsWith(BROWSE_FOLDER_DROP_PREFIX)
      ) {
        dropTargetRectRef.current = undefined;
        return;
      }

      const targetFolderNodeId = operation.target.id.slice(
        BROWSE_FOLDER_DROP_PREFIX.length,
      );
      dropTargetRectRef.current =
        operation.target.element?.getBoundingClientRect();
      const { primaryNodeId, nodeIds } = operation.source
        .data as BrowseNodeDragData;
      const movableNodeIds = nodeIds.filter(
        (nodeId) => nodeId !== targetFolderNodeId,
      );
      if (movableNodeIds.length === 0) return;

      const pendingDrop = {
        primaryNodeId,
        nodeIds: movableNodeIds,
        targetFolderNodeId,
      };
      setPendingFolderDrop(pendingDrop);
      moveNodesToFolder.mutate(
        {
          nodeIds: movableNodeIds,
          folderPath,
          targetFolderNodeId,
          sourceCollectionSlug: collectionSlug,
        },
        {
          onSettled: () => {
            setPendingFolderDrop((current) =>
              current === pendingDrop ? undefined : current,
            );
          },
        },
      );
    },
  });

  useEffect(() => {
    activateSelectionScope(boardKey);
  }, [activateSelectionScope, boardKey]);

  useEffect(() => {
    if (selection.scopeKey !== boardKey) return;
    replaceSelection(
      boardKey,
      selectedIds.filter((nodeId) => eligibleNodeIds.has(nodeId)),
    );
  }, [
    boardKey,
    eligibleNodeIds,
    replaceSelection,
    selectedIds,
    selection.scopeKey,
  ]);

  useEffect(() => {
    setVisibleAssetCount(ASSET_PAGE_SIZE);
  }, [assets, boardKey]);

  useEffect(() => {
    if (!focusedNodeId) return;
    const index = assets.findIndex((node) => node.id === focusedNodeId);
    if (index < 0) return;

    if (index >= visibleAssetCount) {
      setVisibleAssetCount(
        Math.min(
          Math.ceil((index + 1) / ASSET_PAGE_SIZE) * ASSET_PAGE_SIZE,
          assets.length,
        ),
      );
      return;
    }

    const frame = requestAnimationFrame(() => {
      surfaceRef.current
        ?.querySelector(`[data-browse-node-id="${focusedNodeId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [assets, focusedNodeId, visibleAssetCount]);

  useEffect(() => {
    const target = loadMoreRef.current;
    const root = scrollRef.current;
    if (!target || !root || !hasMoreAssets) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleAssetCount((count) =>
            Math.min(count + ASSET_PAGE_SIZE, assets.length),
          );
        }
      },
      { root, rootMargin: "600px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [assets.length, hasMoreAssets, visibleAssetCount]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isSelectionShortcutBlocked(event.target)) return;
      if (event.key === "Escape") {
        clearSelection(boardKey);
        return;
      }
      if (isSelectionShortcut(event)) {
        event.preventDefault();
        replaceSelection(boardKey, eligibleNodeIds);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [boardKey, clearSelection, eligibleNodeIds, replaceSelection]);

  const handleSelectionContextMenu = useCallback(
    (nodeId: string, event: MouseEvent<HTMLDivElement>) => {
      const current = selectionRef.current;
      if (current.selectedIds.has(nodeId) && current.count > 1) {
        event.preventDefault();
        event.stopPropagation();
      } else if (!current.selectedIds.has(nodeId) && current.count > 0) {
        clearSelection(boardKey);
      }
    },
    [boardKey, clearSelection],
  );

  const renderCard = (node: CollectionNode) => (
    <BrowseNodeCard
      key={node.type === "image" ? (node.clientId ?? node.id) : node.id}
      node={node}
      selectedNodeIds={selectedIds}
      isSelected={selectedIdSet.has(node.id)}
      isFocused={focusedNodeId === node.id}
      activeDrag={activeDrag}
      pendingFolderDrop={pendingFolderDrop}
      deleteContext={{
        workspaceSlug,
        collectionSlug,
        folderPath,
        expectedParentFolderNodeId,
      }}
      onToggleSelection={(nodeId) => toggleSelectedNode(boardKey, nodeId)}
      onSelectionContextMenu={handleSelectionContextMenu}
      onOpenFolder={onOpenFolder}
      onOpenImage={onOpenImage}
      onOpenNote={onOpenNote}
    />
  );

  const isEmpty = folders.length === 0 && assets.length === 0;

  return (
    <>
      <ScrollArea
        viewportRef={scrollRef}
        className="h-full min-h-0 w-full min-w-0 flex-1 rounded-[inherit] [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:inset-y-2 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:right-1 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-0"
      >
        <div
          ref={surfaceRef}
          className="relative min-h-full w-full p-5 pb-20"
          onPointerDownCapture={marquee.onPointerDownCapture}
          onPointerMoveCapture={marquee.onPointerMoveCapture}
          onPointerUpCapture={marquee.onPointerUpCapture}
          onPointerCancelCapture={marquee.onPointerCancelCapture}
          onClickCapture={marquee.consumeClick}
          onClick={(event) => {
            if (event.target === event.currentTarget) clearSelection(boardKey);
          }}
        >
          <div className="pointer-events-auto sticky top-5 z-20 mx-auto h-0 w-fit">
            <SelectionActionBar
              count={selectedIds.length}
              surface="browse"
              onClear={() => clearSelection(boardKey)}
              onMove={() => setMoveDialogOpen(true)}
              onDelete={() => {
                bulkDelete.mutate(
                  { nodeIds: selectedIds, collectionSlug },
                  { onSuccess: () => clearSelection(boardKey) },
                );
              }}
            />
          </div>

          {isEmpty ? (
            <div className="flex min-h-96 items-center justify-center px-6 text-center">
              <div className="max-w-sm space-y-1.5">
                <h2 className="text-sm font-medium">{emptyTitle}</h2>
                <p className="text-sm text-muted-foreground">
                  {emptyDescription}
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-10">
              {folders.length > 0 ? (
                <section aria-labelledby="browse-folders-title">
                  <div className="mb-3 flex items-baseline gap-2">
                    <h2
                      id="browse-folders-title"
                      className="text-xs font-semibold tracking-wide text-foreground/80 uppercase"
                    >
                      Folders
                    </h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {folders.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {folders.map(renderCard)}
                  </div>
                </section>
              ) : null}

              <section aria-labelledby="browse-assets-title">
                <div className="mb-3 flex items-baseline gap-2">
                  <h2
                    id="browse-assets-title"
                    className="text-xs font-semibold tracking-wide text-foreground/80 uppercase"
                  >
                    Assets
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {assets.length}
                  </span>
                </div>
                {assets.length > 0 ? (
                  <>
                    <Masonry className="min-w-0">
                      {visibleAssets.map(renderCard)}
                    </Masonry>
                    <div
                      ref={loadMoreRef}
                      className="h-px"
                      aria-hidden="true"
                    />
                  </>
                ) : (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    No matching assets.
                  </p>
                )}
              </section>
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
          <MoveToDialog
            open={moveDialogOpen && selectedIds.length > 0}
            onOpenChange={setMoveDialogOpen}
            source={{
              workspaceSlug,
              sourceCollectionSlug: collectionSlug,
              sourceFolderPath: folderPath,
              nodeIds: selectedIds,
            }}
            onMoved={() => clearSelection(boardKey)}
          />
        </div>
        {loadError ? (
          <div className="absolute inset-0 z-10">{loadError}</div>
        ) : null}
      </ScrollArea>
      <BrowseDragOverlay
        nodeById={nodeById}
        dropTargetRectRef={dropTargetRectRef}
      />
    </>
  );
}

function BrowseNodeCard({
  node,
  selectedNodeIds,
  isSelected,
  isFocused,
  activeDrag,
  pendingFolderDrop,
  deleteContext,
  onToggleSelection,
  onSelectionContextMenu,
  onOpenFolder,
  onOpenImage,
  onOpenNote,
}: {
  node: CollectionNode;
  selectedNodeIds: readonly string[];
  isSelected: boolean;
  isFocused: boolean;
  activeDrag?: BrowseNodeDragData;
  pendingFolderDrop?: PendingFolderDrop;
  deleteContext: {
    workspaceSlug: string;
    collectionSlug: string;
    folderPath?: string;
    expectedParentFolderNodeId: string | null;
  };
  onToggleSelection: (nodeId: string) => void;
  onSelectionContextMenu: (
    nodeId: string,
    event: MouseEvent<HTMLDivElement>,
  ) => void;
  onOpenFolder: (node: Extract<CollectionNode, { type: "folder" }>) => void;
  onOpenImage: (node: Extract<CollectionNode, { type: "image" }>) => void;
  onOpenNote: (
    node: Extract<CollectionNode, { type: "note" }>,
    mode?: "read" | "edit",
  ) => void;
}) {
  const draggableNodeIds = isSelected ? selectedNodeIds : [node.id];
  const isPartOfActiveDrag = activeDrag?.nodeIds.includes(node.id) === true;
  const { ref: draggableRef, isDragging } = useDraggable<BrowseNodeDragData>({
    id: `browse-node:${node.id}`,
    type: BROWSE_NODE_DRAG_TYPE,
    data: { primaryNodeId: node.id, nodeIds: [...draggableNodeIds] },
    disabled: !isPersistedSelectableAsset(node),
  });
  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: `${BROWSE_FOLDER_DROP_PREFIX}${node.id}`,
    type: "browse-folder",
    accept: BROWSE_NODE_DRAG_TYPE,
    disabled:
      node.type !== "folder" || activeDrag?.nodeIds.includes(node.id) === true,
  });
  const asset = collectionNodeToAsset(node);
  const isPendingDropTarget =
    node.type === "folder" && pendingFolderDrop?.targetFolderNodeId === node.id;
  const showDropTarget =
    node.type === "folder" && (isDropTarget || isPendingDropTarget);
  const incomingNodeIds = isPendingDropTarget
    ? pendingFolderDrop.nodeIds
    : isDropTarget
      ? activeDrag?.nodeIds
      : undefined;

  return (
    <div
      ref={(element) => {
        draggableRef(element);
        droppableRef(element);
      }}
      data-browse-node-id={node.id}
      aria-grabbed={isDragging || undefined}
      className={cn(
        "rounded-lg transition-opacity",
        isPersistedSelectableAsset(node) &&
          "cursor-grab active:cursor-grabbing",
        isPartOfActiveDrag && "opacity-45",
        isFocused && "outline-2 outline-primary outline-offset-2",
        showDropTarget &&
          "bg-accent/45 ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <AssetCard
        asset={asset}
        deleteContext={deleteContext}
        isSelected={isSelected}
        onToggleSelection={onToggleSelection}
        onSelectionContextMenu={onSelectionContextMenu}
        folderDropState={
          node.type === "folder"
            ? {
                isDropTarget: showDropTarget,
                incomingAssetId: incomingNodeIds?.[0],
                incomingAssetCount: incomingNodeIds?.length,
              }
            : undefined
        }
        onOpenFolder={
          node.type === "folder" ? () => onOpenFolder(node) : undefined
        }
        onOpenImage={
          node.type === "image" ? () => onOpenImage(node) : undefined
        }
        onOpenNote={
          node.type === "note"
            ? (_asset, mode) => onOpenNote(node, mode)
            : undefined
        }
      />
    </div>
  );
}

function BrowseDragOverlay({
  nodeById,
  dropTargetRectRef,
}: {
  nodeById: ReadonlyMap<string, CollectionNode>;
  dropTargetRectRef: React.RefObject<DOMRect | undefined>;
}) {
  const animateDrop = useCallback(
    async ({ feedbackElement }: { feedbackElement: Element }) => {
      const targetRect = dropTargetRectRef.current;
      if (!(feedbackElement instanceof HTMLElement) || !targetRect) return;

      const overlayRect = feedbackElement.getBoundingClientRect();
      const translateX =
        targetRect.left +
        targetRect.width / 2 -
        (overlayRect.left + overlayRect.width / 2);
      const translateY =
        targetRect.top +
        targetRect.height / 2 -
        (overlayRect.top + overlayRect.height / 2);
      await feedbackElement
        .animate(
          [
            { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
            {
              opacity: 0,
              transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(0.45)`,
            },
          ],
          {
            duration: 180,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          },
        )
        .finished.catch(() => undefined);
    },
    [dropTargetRectRef],
  );

  return (
    <DragOverlay
      className="pointer-events-none z-50 overflow-visible select-none"
      dropAnimation={animateDrop}
    >
      {(source) => {
        if (source.type !== BROWSE_NODE_DRAG_TYPE) return null;
        const { primaryNodeId, nodeIds } = source.data as BrowseNodeDragData;
        const draggedNodes = [primaryNodeId, ...nodeIds].flatMap(
          (nodeId, index) => {
            if (index > 0 && nodeId === primaryNodeId) return [];
            const node = nodeById.get(nodeId);
            return node ? [node] : [];
          },
        );
        const previewNodes = draggedNodes.slice(0, 4);
        if (previewNodes.length === 0) return null;

        const width = source.element?.getBoundingClientRect().width ?? 260;
        return (
          <div className="relative drop-shadow-xl" style={{ width }}>
            {previewNodes.map((node, index) => (
              <div
                key={node.id}
                className={cn(
                  "rounded-lg bg-background ring-2 ring-ring ring-offset-2 ring-offset-background",
                  index > 0 && "absolute inset-x-0 top-0",
                )}
                style={{
                  zIndex: previewNodes.length - index,
                  transform:
                    index === 0
                      ? undefined
                      : `translate3d(${index % 2 === 0 ? -index * 7 : index * 7}px, ${index * 11}px, 0) rotate(${index % 2 === 0 ? -index * 1.5 : index * 1.5}deg) scale(${1 - index * 0.035})`,
                  transformOrigin: "top center",
                }}
              >
                <AssetCard asset={collectionNodeToAsset(node)} />
              </div>
            ))}
          </div>
        );
      }}
    </DragOverlay>
  );
}

function isFolderNode(
  node: CollectionNode,
): node is Extract<CollectionNode, { type: "folder" }> {
  return node.type === "folder";
}
