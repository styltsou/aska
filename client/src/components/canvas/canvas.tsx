import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type NodeChange,
  type NodeTypes,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { CollectionNode } from "@/api/collection";
import {
  useBulkDelete,
  useMoveCollectionNodeToFolder,
  useUpdateCollectionNodePosition,
  useUpdateCollectionNodePositions,
} from "@/api/collection";
import { SelectionActionBar } from "@/components/selection/selection-action-bar";
import { useTheme } from "@/components/theme-provider";
import { useMarqueeSelection } from "@/components/board/use-marquee-selection";
import {
  hasSelectionModifier,
  isPersistedSelectableAsset,
  isSelectionShortcut,
  isSelectionShortcutBlocked,
  selectionIdsForScope,
} from "@/lib/selection";
import { usePersistedStore, useTransientStore } from "@/store";
import { toast } from "sonner";

import { formatPlatformShortcut } from "@/lib/platform";
import { makeBoardKey } from "./canvas-key";
import {
  BOARD_CARD_WIDTH,
  arrangeNodesInGrid,
  compactNodesInMasonry,
  makeNodesInColumn,
  makeNodesInRow,
  type CanvasLayoutNode,
  getInitialNodePosition,
} from "./canvas-node-layout";
import { createLatestValueQueue } from "./latest-value-queue";
import { CanvasControls } from "./canvas-controls";
import {
  CanvasCard,
  type CanvasNode,
  type CanvasNodeData,
} from "./canvas-card";

const DEFAULT_VIEWPORT = { x: 40, y: 40, zoom: 1.1 };
const BOARD_VIEWPORT_INSET = 24;
const BOARD_CONTROLS_CLEARANCE = 72;
const DRAGGING_NODE_Z_INDEX = 1;
const nodeTypes: NodeTypes = { asset: CanvasCard };

type CanvasProps = {
  workspaceSlug: string;
  collectionSlug: string;
  folderPath?: string;
  expectedParentFolderNodeId: string | null;
  nodes: CollectionNode[];
  isColorFilterActive?: boolean;
  colorMatchNodeIds?: ReadonlySet<string>;
  focusedNodeId?: string;
  emptyTitle: string;
  emptyDescription: string;
  onOpenFolder: (node: Extract<CollectionNode, { type: "folder" }>) => void;
  onOpenImage: (node: Extract<CollectionNode, { type: "image" }>) => void;
  onOpenNote: (node: Extract<CollectionNode, { type: "note" }>) => void;
};

type ActionRefs = Pick<
  CanvasProps,
  "onOpenFolder" | "onOpenImage" | "onOpenNote"
>;

type QueuedPositionSave = {
  nodeId: string;
  folderPath?: string;
  position: XYPosition;
  expectedParentFolderNodeId: string | null;
  version: number;
  origin: XYPosition;
};

type PendingFolderDrop = {
  assetId: string;
  targetFolderNodeId: string;
};

type CanvasDragSession = {
  primaryNodeId: string;
  origins: Map<string, XYPosition>;
  isGroup: boolean;
};

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasSurface {...props} />
    </ReactFlowProvider>
  );
}

function CanvasSurface({
  workspaceSlug,
  collectionSlug,
  folderPath,
  expectedParentFolderNodeId,
  nodes,
  isColorFilterActive = false,
  colorMatchNodeIds,
  focusedNodeId,
  emptyTitle,
  emptyDescription,
  onOpenFolder,
  onOpenImage,
  onOpenNote,
}: CanvasProps) {
  const boardKey = makeBoardKey(workspaceSlug, collectionSlug, folderPath);
  const storedViewport = usePersistedStore(
    (state) => state.boardViewports[boardKey],
  );
  const isCanvasLocked = usePersistedStore(
    (state) => state.boardLocks[boardKey] ?? false,
  );
  const setStoredViewport = usePersistedStore(
    (state) => state.setBoardViewport,
  );
  const setBoardVisibleBounds = useTransientStore(
    (state) => state.setBoardVisibleBounds,
  );
  const setCanvasLock = usePersistedStore((state) => state.setBoardLock);
  const setInsertionPosition = useTransientStore(
    (state) => state.setInsertionPosition,
  );
  const selection = useTransientStore((state) => state.selection);
  const activateSelectionScope = useTransientStore(
    (state) => state.activateSelectionScope,
  );
  const replaceSelection = useTransientStore((state) => state.replaceSelection);
  const toggleSelectedNode = useTransientStore(
    (state) => state.toggleSelectedNode,
  );
  const clearSelection = useTransientStore((state) => state.clearSelection);
  const updatePosition = useUpdateCollectionNodePosition(
    workspaceSlug,
    collectionSlug,
  );
  const updatePositions = useUpdateCollectionNodePositions(
    workspaceSlug,
    collectionSlug,
  );
  const moveNodeToFolder = useMoveCollectionNodeToFolder(
    workspaceSlug,
    collectionSlug,
  );
  const bulkDelete = useBulkDelete(workspaceSlug);
  const { theme } = useTheme();
  const {
    fitView,
    getIntersectingNodes,
    getNode,
    getNodes,
    getViewport,
    screenToFlowPosition,
  } = useReactFlow<CanvasNode>();
  const boardRef = useRef<HTMLDivElement>(null);
  const suppressedClickIdsRef = useRef(new Set<string>());
  const dragSessionRef = useRef<CanvasDragSession | undefined>(undefined);
  const dropTargetNodeIdRef = useRef<string | undefined>(undefined);
  const dragVersionRef = useRef(new Map<string, number>());
  const pendingNodePositionsRef = useRef(new Map<string, XYPosition>());
  const persistPositionRef = useRef<
    (save: QueuedPositionSave) => Promise<void>
  >(async () => {});
  const positionSaveQueueRef = useRef(
    createLatestValueQueue<QueuedPositionSave>((_nodeId, save) =>
      persistPositionRef.current(save),
    ),
  );
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string>();
  const [pendingFolderDrop, setPendingFolderDrop] =
    useState<PendingFolderDrop>();
  const actionRefs = useRef<ActionRefs>({
    onOpenFolder,
    onOpenImage,
    onOpenNote,
  });
  actionRefs.current = { onOpenFolder, onOpenImage, onOpenNote };
  const selectedIds = useMemo(
    () => selectionIdsForScope(selection, boardKey),
    [boardKey, selection],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectionRef = useRef({ selectedIds: selectedIdSet, count: 0 });
  selectionRef.current = {
    selectedIds: selectedIdSet,
    count: selectedIds.length,
  };
  const eligibleNodeIds = useMemo(
    () =>
      new Set(
        nodes
          .filter(
            (node) =>
              isPersistedSelectableAsset(node) &&
              !(
                isColorFilterActive &&
                node.type !== "folder" &&
                !colorMatchNodeIds?.has(node.id)
              ),
          )
          .map((node) => node.id),
      ),
    [colorMatchNodeIds, isColorFilterActive, nodes],
  );
  const marquee = useMarqueeSelection({
    surfaceRef: boardRef,
    eligibleNodeIds,
    onReplace: (nodeIds) => replaceSelection(boardKey, nodeIds),
    shouldStart: (event) =>
      !(event.target instanceof Element) ||
      !event.target.closest(".react-flow__node"),
    stopNativeEvents: true,
  });

  const handleBulkDelete = useCallback(() => {
    bulkDelete.mutate(
      { nodeIds: selectedIds, collectionSlug },
      {
        onSuccess: () => {
          clearSelection(boardKey);
        },
      },
    );
  }, [bulkDelete, collectionSlug, selectedIds, clearSelection, boardKey]);

  const publishVisibleBounds = useCallback(
    (viewport: Viewport) => {
      const board = boardRef.current;
      if (!board) return;

      const { width, height } = board.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const { x, y, zoom } = viewport;
      setBoardVisibleBounds(boardKey, {
        left: (BOARD_VIEWPORT_INSET - x) / zoom,
        top: (BOARD_VIEWPORT_INSET - y) / zoom,
        right: (width - BOARD_CONTROLS_CLEARANCE - x) / zoom,
        bottom: (height - BOARD_CONTROLS_CLEARANCE - y) / zoom,
      });
    },
    [boardKey, setBoardVisibleBounds],
  );

  const applySelectedNodeLayout = useCallback(
    (layout: typeof arrangeNodesInGrid) => {
      const currentFlowNodes = getNodes();
      const flowNodesById = new Map(
        currentFlowNodes.map((node) => [node.id, node]),
      );

      const selectedNodes: CanvasLayoutNode[] = [];

      for (const node of nodes) {
        if (selectedIdSet.has(node.id)) {
          const flowNode = flowNodesById.get(node.id);
          selectedNodes.push({
            ...node,
            position: flowNode?.position ?? node.position,
            layoutWidth: flowNode?.measured?.width,
            layoutHeight: flowNode?.measured?.height,
          });
        }
      }

      if (selectedNodes.length < 2) return;

      const targetPositions = layout(selectedNodes);
      const startPositions = new Map(
        selectedNodes.map((node) => [node.id, node.position ?? { x: 0, y: 0 }]),
      );
      const targetPositionMap = new Map(
        selectedNodes.map((node, index) => [node.id, targetPositions[index]!]),
      );
      const saves = selectedNodes.map((node, index) => ({
        nodeId: node.id,
        position: targetPositions[index]!,
      }));

      let cancelled = false;
      const duration = 150;
      function animate(currentTime: number, startTime: number) {
        if (cancelled) return;

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        setFlowNodes((current) =>
          current.map((node) => {
            const start = startPositions.get(node.id);
            const target = targetPositionMap.get(node.id);
            if (!start || !target) return node;
            return {
              ...node,
              position: {
                x: start.x + (target.x - start.x) * eased,
                y: start.y + (target.y - start.y) * eased,
              },
            };
          }),
        );

        if (progress < 1) {
          requestAnimationFrame((t) => animate(t, startTime));
        }
      }

      requestAnimationFrame((t) => animate(t, t));

      updatePositions.mutate(
        {
          folderPath,
          expectedParentFolderNodeId,
          positions: saves,
        },
        {
          onError: () => {
            cancelled = true;
            setFlowNodes((current) =>
              selectedNodes.reduce((next, node) => {
                const original = node.position;
                return original
                  ? updateLocalNodePosition(next, node.id, original)
                  : next;
              }, current),
            );
            toast.error("Unable to update the card layout.");
          },
        },
      );
    },
    [
      folderPath,
      expectedParentFolderNodeId,
      nodes,
      selectedIdSet,
      getNodes,
      updatePositions,
    ],
  );

  const handleArrange = useCallback(
    () => applySelectedNodeLayout(arrangeNodesInGrid),
    [applySelectedNodeLayout],
  );
  const handleCompact = useCallback(
    () => applySelectedNodeLayout(compactNodesInMasonry),
    [applySelectedNodeLayout],
  );
  const handleMakeRow = useCallback(
    () => applySelectedNodeLayout(makeNodesInRow),
    [applySelectedNodeLayout],
  );
  const handleMakeColumn = useCallback(
    () => applySelectedNodeLayout(makeNodesInColumn),
    [applySelectedNodeLayout],
  );

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const updateVisibleBounds = () => publishVisibleBounds(getViewport());
    updateVisibleBounds();

    const observer = new ResizeObserver(updateVisibleBounds);
    observer.observe(board);
    return () => observer.disconnect();
  }, [getViewport, publishVisibleBounds]);

  const openFolder = useCallback(
    (node: Extract<CollectionNode, { type: "folder" }>) =>
      actionRefs.current.onOpenFolder(node),
    [],
  );
  const openImage = useCallback(
    (node: Extract<CollectionNode, { type: "image" }>) =>
      actionRefs.current.onOpenImage(node),
    [],
  );
  const openNote = useCallback(
    (node: Extract<CollectionNode, { type: "note" }>) =>
      actionRefs.current.onOpenNote(node),
    [],
  );
  const suppressClick = useCallback(
    (nodeId: string) => suppressedClickIdsRef.current.has(nodeId),
    [],
  );
  const suppressClicks = useCallback((...nodeIds: string[]) => {
    nodeIds.forEach((nodeId) => suppressedClickIdsRef.current.add(nodeId));
    window.setTimeout(() => {
      nodeIds.forEach((nodeId) => suppressedClickIdsRef.current.delete(nodeId));
    });
  }, []);
  const handleCardClick = useCallback(
    (nodeId: string, event: ReactMouseEvent) => {
      if (hasSelectionModifier(event)) {
        if (eligibleNodeIds.has(nodeId)) {
          toggleSelectedNode(boardKey, nodeId);
        }
      } else {
        clearSelection(boardKey);
      }
      event.stopPropagation();
    },
    [boardKey, clearSelection, eligibleNodeIds, toggleSelectedNode],
  );
  const clearDropTarget = useCallback(() => {
    dropTargetNodeIdRef.current = undefined;
    setDropTargetNodeId((current) =>
      current === undefined ? current : undefined,
    );
  }, []);
  const handleNodeContextMenu = useCallback(
    (nodeId: string, event: ReactMouseEvent) => {
      const { selectedIds, count } = selectionRef.current;
      if (selectedIds.has(nodeId) && count > 1) {
        event.preventDefault();
        event.stopPropagation();
      } else if (!selectedIds.has(nodeId) && count > 0) {
        clearSelection(boardKey);
      }
    },
    [boardKey, clearSelection],
  );

  const makeNodeData = useCallback(
    (collectionNode: CollectionNode): CanvasNodeData => {
      const isHoveredDropTarget =
        collectionNode.type === "folder" &&
        collectionNode.id === dropTargetNodeId;
      const isPendingDropTarget =
        collectionNode.type === "folder" &&
        collectionNode.id === pendingFolderDrop?.targetFolderNodeId;
      return {
        collectionNode,
        deleteContext: { workspaceSlug, collectionSlug, folderPath },
        onOpenFolder: openFolder,
        onOpenImage: openImage,
        onOpenNote: openNote,
        onCardClick: handleCardClick,
        suppressClick,
        isColorDimmed:
          isColorFilterActive &&
          collectionNode.type !== "folder" &&
          !colorMatchNodeIds?.has(collectionNode.id),
        isColorFocused: collectionNode.id === focusedNodeId,
        isDropTarget:
          collectionNode.type === "folder" &&
          (isHoveredDropTarget || isPendingDropTarget),
        incomingDropAssetId: isPendingDropTarget
          ? pendingFolderDrop.assetId
          : isHoveredDropTarget
            ? dragSessionRef.current?.primaryNodeId
            : undefined,
        onContextMenu: handleNodeContextMenu,
      };
    },
    [
      collectionSlug,
      colorMatchNodeIds,
      dropTargetNodeId,
      folderPath,
      focusedNodeId,
      isColorFilterActive,
      openFolder,
      openImage,
      openNote,
      pendingFolderDrop,
      suppressClick,
      workspaceSlug,
      handleNodeContextMenu,
      handleCardClick,
    ],
  );

  const [flowNodes, setFlowNodes] = useState<CanvasNode[]>(() =>
    nodes.map((node, index) => makeFlowNode(node, index, makeNodeData(node))),
  );

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

  useLayoutEffect(() => {
    setFlowNodes((current) => {
      let changed = false;
      const next = current.map((node) => {
        const selected =
          selectedIdSet.has(node.id) && eligibleNodeIds.has(node.id);
        if (node.selected === selected) return node;
        changed = true;
        return { ...node, selected };
      });
      return changed ? next : current;
    });
  }, [eligibleNodeIds, selectedIdSet]);

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

  useLayoutEffect(() => {
    if (!pendingFolderDrop) return;

    const target = flowNodes.find(
      (node) => node.id === pendingFolderDrop.targetFolderNodeId,
    )?.data.collectionNode;
    if (
      target?.type !== "folder" ||
      !target.previews.some(
        (preview) => preview.assetId === pendingFolderDrop.assetId,
      )
    ) {
      return;
    }

    setPendingFolderDrop((current) =>
      current?.assetId === pendingFolderDrop.assetId &&
      current.targetFolderNodeId === pendingFolderDrop.targetFolderNodeId
        ? undefined
        : current,
    );
  }, [flowNodes, pendingFolderDrop]);

  persistPositionRef.current = (save) =>
    updatePosition
      .mutateAsync(
        {
          nodeId: save.nodeId,
          folderPath: save.folderPath,
          position: save.position,
          expectedParentFolderNodeId: save.expectedParentFolderNodeId,
        },
        {
          onError: () => {
            if (dragVersionRef.current.get(save.nodeId) !== save.version) {
              return;
            }
            setFlowNodes((current) =>
              updateLocalNodePosition(current, save.nodeId, save.origin),
            );
          },
        },
      )
      .then(() => undefined);

  useEffect(() => {
    setFlowNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      const currentByClientId = new Map(
        current.flatMap((node) => {
          const clientId = getNodeClientId(node.data.collectionNode);
          return clientId ? [[clientId, node] as const] : [];
        }),
      );

      return nodes.map((node, index) =>
        makeFlowNode(
          node,
          index,
          makeNodeData(node),
          currentById.get(node.id) ??
            currentByClientId.get(getNodeClientId(node) ?? ""),
        ),
      );
    });
  }, [makeNodeData, nodes]);

  useEffect(() => {
    const currentClientIds = new Set(
      nodes.flatMap((node) => {
        const clientId = getNodeClientId(node);
        return clientId ? [clientId] : [];
      }),
    );

    for (const clientId of pendingNodePositionsRef.current.keys()) {
      if (!currentClientIds.has(clientId)) {
        pendingNodePositionsRef.current.delete(clientId);
      }
    }

    nodes.forEach((node, index) => {
      if (isPendingCollectionNode(node)) return;

      const clientId = getNodeClientId(node);
      const pendingPosition = clientId
        ? pendingNodePositionsRef.current.get(clientId)
        : undefined;
      if (!pendingPosition) return;

      pendingNodePositionsRef.current.delete(clientId!);
      const persistedPosition = getInitialNodePosition(node, index);
      if (positionsEqual(persistedPosition, pendingPosition)) return;

      updatePosition.mutate({
        nodeId: node.id,
        folderPath,
        position: pendingPosition,
        expectedParentFolderNodeId,
      });
    });
  }, [expectedParentFolderNodeId, folderPath, nodes, updatePosition]);

  useEffect(() => {
    if (!focusedNodeId) return;

    const node = getNode(focusedNodeId);
    if (!node) return;

    void fitView({
      nodes: [node],
      padding: 0.45,
      maxZoom: 1.15,
      duration: 150,
    });
  }, [fitView, focusedNodeId, getNode]);

  const handleNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    setFlowNodes((current) => applyNodeChanges(changes, current));
  }, []);
  const updateDropTarget = useCallback(
    (event: MouseEvent | TouchEvent, node: CanvasNode) => {
      if (!isDraggableNode(node)) {
        clearDropTarget();
        return;
      }

      const clientPosition = getClientPosition(event);
      if (!clientPosition) return;

      const position = screenToFlowPosition(clientPosition);
      const orderedNodes = getNodes();
      const nodeOrder = new Map(
        orderedNodes.map((current, index) => [current.id, index]),
      );
      const target = getIntersectingNodes(
        { x: position.x, y: position.y, width: 1, height: 1 },
        true,
      )
        .filter(
          (candidate) =>
            candidate.id !== node.id &&
            candidate.data.collectionNode.type === "folder",
        )
        .sort((left, right) => {
          const zIndexDelta = (right.zIndex ?? 0) - (left.zIndex ?? 0);
          if (zIndexDelta !== 0) return zIndexDelta;

          const orderDelta =
            (nodeOrder.get(right.id) ?? -1) - (nodeOrder.get(left.id) ?? -1);
          return orderDelta !== 0
            ? orderDelta
            : left.id.localeCompare(right.id);
        })[0];
      const nextTargetId = target?.id;

      if (dropTargetNodeIdRef.current === nextTargetId) return;
      dropTargetNodeIdRef.current = nextTargetId;
      setDropTargetNodeId(nextTargetId);
    },
    [clearDropTarget, getIntersectingNodes, getNodes, screenToFlowPosition],
  );

  return (
    <div
      ref={boardRef}
      className="relative h-full min-h-0 w-full bg-transparent"
      onPointerDownCapture={marquee.onPointerDownCapture}
      onPointerMoveCapture={marquee.onPointerMoveCapture}
      onPointerUpCapture={marquee.onPointerUpCapture}
      onPointerCancelCapture={marquee.onPointerCancelCapture}
      onClickCapture={(event) => {
        marquee.consumeClick(event);
      }}
    >
      <ReactFlow<CanvasNode>
        className="aska-flow"
        nodes={flowNodes}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        defaultViewport={storedViewport ?? DEFAULT_VIEWPORT}
        minZoom={0.15}
        maxZoom={2}
        colorMode={theme}
        deleteKeyCode={null}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        elevateNodesOnSelect={false}
        nodesDraggable={!isCanvasLocked}
        autoPanOnNodeDrag={!isCanvasLocked}
        selectionKeyCode={["Control", "Meta"]}
        multiSelectionKeyCode={["Control", "Meta"]}
        selectionMode={SelectionMode.Full}
        selectionOnDrag={false}
        panOnDrag
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        onMoveEnd={(_, viewport) => {
          setStoredViewport(boardKey, viewport);
          publishVisibleBounds(viewport);
        }}
        onPaneContextMenu={(event) => {
          clearSelection(boardKey);
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          setInsertionPosition(boardKey, roundPosition(position));
        }}
        onPaneClick={() => clearSelection(boardKey)}
        onNodeDragStart={(_, node, movedNodes) => {
          clearDropTarget();
          setFlowNodes((current) => {
            let changed = false;
            const next = current.map((flowNode) => {
              const selected =
                selectedIdSet.has(flowNode.id) &&
                eligibleNodeIds.has(flowNode.id);
              if (flowNode.selected === selected) return flowNode;
              changed = true;
              return { ...flowNode, selected };
            });
            return changed ? next : current;
          });
          const dragNodes = movedNodes.length > 0 ? movedNodes : [node];
          const draggedNodeIds = new Set(
            dragNodes.map((dragNode) => dragNode.id),
          );
          setFlowNodes((current) =>
            current.map((flowNode) =>
              draggedNodeIds.has(flowNode.id)
                ? { ...flowNode, zIndex: DRAGGING_NODE_Z_INDEX }
                : flowNode,
            ),
          );
          dragSessionRef.current = {
            primaryNodeId: node.id,
            origins: new Map(
              dragNodes.map((dragNode) => [
                dragNode.id,
                roundPosition(dragNode.position),
              ]),
            ),
            isGroup: dragNodes.length > 1,
          };
        }}
        onNodeDrag={(event, node) => {
          if (dragSessionRef.current?.isGroup) return;
          updateDropTarget(event, node);
        }}
        onNodeDragStop={(_, node, movedNodes) => {
          const session = dragSessionRef.current;
          const dragNodes = movedNodes.length > 0 ? movedNodes : [node];
          dragSessionRef.current = undefined;
          const draggedNodeIds = new Set(
            dragNodes.map((dragNode) => dragNode.id),
          );
          setFlowNodes((current) =>
            current.map((flowNode) =>
              draggedNodeIds.has(flowNode.id)
                ? { ...flowNode, zIndex: 0 }
                : flowNode,
            ),
          );
          const targetFolderNodeId = dropTargetNodeIdRef.current;
          clearDropTarget();

          if (!session || session.primaryNodeId !== node.id) return;

          if (!session.isGroup && targetFolderNodeId && isDraggableNode(node)) {
            const origin = session.origins.get(node.id);
            if (!origin) return;
            suppressClicks(node.id, targetFolderNodeId);
            setPendingFolderDrop({
              assetId: node.id,
              targetFolderNodeId,
            });
            moveNodeToFolder.mutate(
              {
                nodeId: node.id,
                folderPath,
                targetFolderNodeId,
                expectedParentFolderNodeId,
              },
              {
                onError: () => {
                  setPendingFolderDrop((current) =>
                    current?.assetId === node.id &&
                    current.targetFolderNodeId === targetFolderNodeId
                      ? undefined
                      : current,
                  );
                  setFlowNodes((current) =>
                    updateLocalNodePosition(current, node.id, origin),
                  );
                },
                onSettled: () => {
                  setPendingFolderDrop((current) =>
                    current?.assetId === node.id &&
                    current.targetFolderNodeId === targetFolderNodeId
                      ? undefined
                      : current,
                  );
                },
              },
            );
            return;
          }

          const moved = dragNodes.flatMap((dragNode) => {
            const origin = session.origins.get(dragNode.id);
            const position = roundPosition(dragNode.position);
            return origin && !positionsEqual(origin, position)
              ? [{ node: dragNode, origin, position }]
              : [];
          });
          if (moved.length === 0) return;

          setFlowNodes((current) =>
            moved.reduce(
              (next, { node: movedNode, position }) =>
                updateLocalNodePosition(next, movedNode.id, position),
              current,
            ),
          );
          suppressClicks(...moved.map(({ node: movedNode }) => movedNode.id));

          if (session.isGroup) {
            const saves = moved.filter(({ node: movedNode }) =>
              isPersistedSelectableAsset(movedNode.data.collectionNode),
            );
            const versions = new Map(
              saves.map(({ node: movedNode }) => {
                const version =
                  (dragVersionRef.current.get(movedNode.id) ?? 0) + 1;
                dragVersionRef.current.set(movedNode.id, version);
                return [movedNode.id, version] as const;
              }),
            );
            if (saves.length > 1) {
              updatePositions.mutate(
                {
                  folderPath,
                  expectedParentFolderNodeId,
                  positions: saves.map(({ node: movedNode, position }) => ({
                    nodeId: movedNode.id,
                    position,
                  })),
                },
                {
                  onError: () => {
                    setFlowNodes((current) =>
                      saves.reduce(
                        (next, { node: movedNode, origin }) =>
                          dragVersionRef.current.get(movedNode.id) ===
                          versions.get(movedNode.id)
                            ? updateLocalNodePosition(
                                next,
                                movedNode.id,
                                origin,
                              )
                            : next,
                        current,
                      ),
                    );
                    toast.error("Unable to save the new card positions.");
                  },
                },
              );
              return;
            }
          }

          const [single] = moved;
          if (!single) return;
          const { node: movedNode, origin, position } = single;
          if (isPendingCollectionNode(movedNode.data.collectionNode)) {
            const clientId = getNodeClientId(movedNode.data.collectionNode);
            if (clientId) {
              pendingNodePositionsRef.current.set(clientId, position);
            }
            return;
          }

          const version = (dragVersionRef.current.get(movedNode.id) ?? 0) + 1;
          dragVersionRef.current.set(movedNode.id, version);
          positionSaveQueueRef.current.enqueue(movedNode.id, {
            nodeId: movedNode.id,
            folderPath,
            position,
            expectedParentFolderNodeId,
            version,
            origin,
          });
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="color-mix(in oklch, var(--foreground) 14%, transparent)"
        />
        <CanvasControls
          isCanvasLocked={isCanvasLocked}
          onCanvasLockChange={(locked) => setCanvasLock(boardKey, locked)}
        />
        <Panel position="top-center" className="m-3">
          <SelectionActionBar
            count={selectedIds.length}
            surface="canvas"
            onClear={() => clearSelection(boardKey)}
            onDelete={handleBulkDelete}
            onArrange={handleArrange}
            onCompact={handleCompact}
            onMakeRow={handleMakeRow}
            onMakeColumn={handleMakeColumn}
          />
        </Panel>
      </ReactFlow>

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="max-w-sm space-y-1.5">
            <h2 className="text-sm font-medium">{emptyTitle}</h2>
            <p className="text-sm text-muted-foreground">{emptyDescription}</p>
            <div className="flex items-center justify-center gap-3 pt-3 text-sm text-muted-foreground/50">
              <span>
                <kbd className="font-sans">{formatPlatformShortcut("⌘+K")}</kbd>{" "}
                Commands
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span>
                <kbd className="font-sans">{formatPlatformShortcut("⇧+P")}</kbd>{" "}
                Scratchpad
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span>
                <kbd className="font-sans">{formatPlatformShortcut("⇧+F")}</kbd>{" "}
                Filter
              </span>
            </div>
          </div>
        </div>
      ) : null}
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

function makeFlowNode(
  collectionNode: CollectionNode,
  index: number,
  data: CanvasNodeData,
  current?: CanvasNode,
): CanvasNode {
  return {
    ...current,
    id: collectionNode.id,
    type: "asset",
    position:
      current?.position ?? getInitialNodePosition(collectionNode, index),
    data,
    draggable: data.isColorDimmed ? false : undefined,
    selectable: false,
    // Resting cards share one layer. This also clears any transient drag layer
    // when server data refreshes after a drag has completed.
    zIndex: current?.dragging ? DRAGGING_NODE_Z_INDEX : 0,
    style: { width: BOARD_CARD_WIDTH },
  };
}

function updateLocalNodePosition(
  nodes: CanvasNode[],
  nodeId: string,
  position: XYPosition,
): CanvasNode[] {
  return nodes.map((node) =>
    node.id === nodeId ? { ...node, position } : node,
  );
}

function roundPosition(position: XYPosition): XYPosition {
  return { x: Math.round(position.x), y: Math.round(position.y) };
}

function positionsEqual(a: XYPosition, b: XYPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function isPendingCollectionNode(node: CollectionNode): boolean {
  return (
    (node.type === "image" && node.uploadStatus !== undefined) ||
    (node.type === "note" && node.id.startsWith("note-optimistic-"))
  );
}

function isDraggableNode(node: CanvasNode): boolean {
  return !isPendingCollectionNode(node.data.collectionNode);
}

function getClientPosition(
  event: MouseEvent | TouchEvent,
): XYPosition | undefined {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }

  const touch = event.touches[0] ?? event.changedTouches[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : undefined;
}

function getNodeClientId(node: CollectionNode): string | undefined {
  if (node.type === "image" || node.type === "note") {
    return node.clientId;
  }

  return undefined;
}
