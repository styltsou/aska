import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  ViewportPortal,
  useReactFlow,
  type NodeChange,
  type NodePositionChange,
  type NodeTypes,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type {
  CanvasArrowEndpoint,
  CanvasArrowObject,
  CanvasObject,
  CanvasTextObject,
  CollectionNode,
} from "@/api/collection";
import type { LinkAsset } from "@/types/asset";
import type { UpdateCanvasItemsGeometryInput } from "@/api/collection/types";
import {
  useBulkDelete,
  useMoveCollectionNodesToFolder,
  useUpdateCollectionNodePosition,
  useCreateCanvasArrow,
  useCreateCanvasText,
  useDeleteCanvasObject,
  useUpdateCanvasArrow,
  useUpdateCanvasItemFrontIndexes,
  useUpdateCanvasText,
  useUpdateCanvasItemsGeometry,
} from "@/api/collection";
import { SelectionActionBar } from "@/components/selection/selection-action-bar";
import { MoveToDialog } from "@/components/move-to-dialog";
import { useTheme } from "@/components/theme-provider";
import {
  selectionMarqueeClassName,
  useMarqueeSelection,
} from "@/components/board/use-marquee-selection";
import {
  hasSelectionModifier,
  isPersistedSelectableAsset,
  isSelectionShortcut,
  isSelectionShortcutBlocked,
  selectionIdsForScope,
} from "@/lib/selection";
import { usePersistedStore, useTransientStore } from "@/store";
import { toast } from "sonner";

import { formatPlatformShortcut, getPlatformModifier } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { CanvasToolCursorIndicator } from "./canvas-tool-cursor-indicator";
import { makeBoardKey } from "./canvas-key";
import { onBatchPlacementCompleted } from "./batch-placement-completed";
import {
  setBoardFlowPositionConverter,
  setBoardPointerPosition,
  setBoardViewportZoomReader,
} from "./board-pointer-position";
import { getCanvasViewShortcutAction } from "./canvas-view-actions";
import { getCanvasWheelZoomViewport } from "./canvas-wheel-zoom";
import { activeCanvasObjectFocus } from "./canvas-object-focus";
import { useCanvasActions } from "./canvas-actions-context";
import {
  BOARD_CARD_WIDTH,
  arrangeNodesInGrid,
  compactNodesInMasonry,
  type LinearLayoutAlignment,
  makeNodesInColumn,
  makeNodesInRow,
  type CanvasLayoutNode,
  getInitialNodePosition,
} from "./canvas-node-layout";
import { createLatestValueQueue } from "./latest-value-queue";
import {
  getCanvasAlignmentBounds,
  getCanvasAlignmentSnap,
  getVisibleCanvasAlignmentRects,
  type CanvasAlignmentGuides,
  type CanvasAlignmentRect,
} from "./canvas-alignment-guides";
import { CanvasAlignmentGuideLines } from "./canvas-alignment-guide-lines";
import {
  makeCanvasDropStackStyles,
  type CanvasDropStackStyle,
} from "./canvas-drop-stack";
import {
  getCanvasFrontZIndex,
  getCanvasInteractionZIndex,
  getCanvasRestingZIndex,
  getCanvasTextRestingZIndex,
  promoteCanvasFrontIndexes,
  updateExpandedNoteOrder,
} from "./canvas-node-stacking";
import {
  CanvasCard,
  type CanvasNode,
  type CanvasNodeData,
} from "./canvas-card";
import {
  CanvasTextNode,
  CanvasTextEditor,
  type CanvasTextFlowNode,
  type CanvasTextNodeData,
} from "./canvas-text-node";
import { CanvasArrowLayer, type DraftCanvasArrow } from "./canvas-arrow-layer";
import { arrowHasIdentity } from "./canvas-arrow-identity";
import {
  getArrowSnapshots,
  getInternalArrowIds,
  getLayoutArrowUpdates,
  getTranslatedArrowUpdates,
  type ArrowSnapshot,
} from "./canvas-selection-geometry";
import {
  CanvasObjectInspector,
  type CanvasInspectorTarget,
} from "./canvas-object-inspector";

const DEFAULT_VIEWPORT = { x: 40, y: 40, zoom: 1.1 };
const BOARD_VIEWPORT_INSET = 24;
const FIT_VIEW_MAX_ZOOM = 1.1;
const VIEWPORT_ANIMATION_DURATION = 150;
const CANVAS_MIN_ZOOM = 0.15;
const CANVAS_MAX_ZOOM = 2;
const PERSISTED_CANVAS_ITEM_ID =
  /^(folder|image|note|link|color|text|arrow)-\d+$/;
type CanvasFlowNode = CanvasNode | CanvasTextFlowNode;
const nodeTypes: NodeTypes = { asset: CanvasCard, text: CanvasTextNode };

type CanvasProps = {
  workspaceSlug: string;
  collectionSlug: string;
  folderPath?: string;
  expectedParentFolderNodeId: string | null;
  nodes: CollectionNode[];
  canvasObjects: readonly CanvasObject[];
  isColorFilterActive?: boolean;
  colorMatchNodeIds?: ReadonlySet<string>;
  focusedNodeId?: string;
  focusRequestId?: number;
  onDismissFocusedNode?: () => void;
  loadError?: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  onOpenFolder: (node: Extract<CollectionNode, { type: "folder" }>) => void;
  onOpenImage: (node: Extract<CollectionNode, { type: "image" }>) => void;
  onOpenColor: (node: Extract<CollectionNode, { type: "color" }>) => void;
  onOpenVideo: (asset: LinkAsset) => void;
  onOpenNote: (
    node: Extract<CollectionNode, { type: "note" }>,
    mode?: "read" | "edit",
  ) => void;
};

type ActionRefs = Pick<
  CanvasProps,
  "onOpenFolder" | "onOpenImage" | "onOpenColor" | "onOpenNote" | "onOpenVideo"
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
  nodeIds: string[];
  nodeIdsKey: string;
  targetFolderNodeId: string;
};

type CanvasDragSession = {
  primaryNodeId: string;
  origins: Map<string, XYPosition>;
  alignmentCandidates: CanvasAlignmentRect[];
  currentPositions: Map<string, XYPosition>;
  draggedRects: Map<string, CanvasAlignmentRect>;
  isGroup: boolean;
  movingIds: Set<string>;
  arrowSnapshots: ArrowSnapshot[];
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
  canvasObjects,
  isColorFilterActive = false,
  colorMatchNodeIds,
  focusedNodeId,
  focusRequestId,
  onDismissFocusedNode,
  loadError,
  emptyTitle,
  emptyDescription,
  onOpenFolder,
  onOpenImage,
  onOpenColor,
  onOpenNote,
  onOpenVideo,
}: CanvasProps) {
  const boardKey = makeBoardKey(workspaceSlug, collectionSlug, folderPath);
  const storedViewport = usePersistedStore(
    (state) => state.boardViewports[boardKey],
  );
  const isCanvasLocked = usePersistedStore(
    (state) => state.boardLocks[boardKey] ?? false,
  );
  const areAlignmentGuidesEnabled = usePersistedStore(
    (state) => state.workspaceAlignmentGuides[workspaceSlug] ?? true,
  );
  const setStoredViewport = usePersistedStore(
    (state) => state.setBoardViewport,
  );
  const setBoardVisibleBounds = useTransientStore(
    (state) => state.setBoardVisibleBounds,
  );
  const setInsertionPosition = useTransientStore(
    (state) => state.setInsertionPosition,
  );
  const notifyCanvasViewportActivity = useTransientStore(
    (state) => state.notifyCanvasViewportActivity,
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
  const updateItemsGeometry = useUpdateCanvasItemsGeometry(
    workspaceSlug,
    collectionSlug,
  );
  const moveNodesToFolder = useMoveCollectionNodesToFolder(
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
    setViewport,
    zoomTo,
  } = useReactFlow<CanvasFlowNode>();
  const boardRef = useRef<HTMLDivElement>(null);
  const lastViewportActivityAtRef = useRef(0);
  const boardSizeRef = useRef({ width: 0, height: 0 });
  const suppressedClickIdsRef = useRef(new Set<string>());
  const dragSessionRef = useRef<CanvasDragSession | undefined>(undefined);
  const arrowGroupDragRef = useRef<
    | {
        origins: Map<string, XYPosition>;
        movingIds: Set<string>;
        arrowSnapshots: ArrowSnapshot[];
      }
    | undefined
  >(undefined);
  const [groupArrowPreviews, setGroupArrowPreviews] =
    useState<
      Record<
        string,
        Pick<
          CanvasArrowObject,
          "start" | "end" | "points" | "routing" | "rotation"
        >
      >
    >();
  const dropTargetNodeIdRef = useRef<string | undefined>(undefined);
  const dropStackStylesRef = useRef(new Map<string, CanvasDropStackStyle>());
  const alignmentBypassRef = useRef(false);
  const dragVersionRef = useRef(new Map<string, number>());
  const pendingNodePositionsRef = useRef(new Map<string, XYPosition>());
  const expandedNoteOrderRef = useRef(updateExpandedNoteOrder([], nodes));
  const persistPositionRef = useRef<
    (save: QueuedPositionSave) => Promise<void>
  >(async () => {});
  const positionSaveQueueRef = useRef(
    createLatestValueQueue<QueuedPositionSave>((_nodeId, save) =>
      persistPositionRef.current(save),
    ),
  );
  const [dropTargetNodeId, setDropTargetNodeId] = useState<string>();
  const [alignmentGuides, setAlignmentGuides] =
    useState<CanvasAlignmentGuides>();
  const [pendingFolderDrop, setPendingFolderDrop] =
    useState<PendingFolderDrop>();
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [draftText, setDraftText] = useState<CanvasTextObject>();
  const [editingTextId, setEditingTextId] = useState<string>();
  const [editingArrowId, setEditingArrowId] = useState<string>();
  const [canvasObjectFocus, setCanvasObjectFocus] = useState<{
    boardKey: string;
    objectId: string;
  }>();
  const draftTextRef = useRef<CanvasTextObject | undefined>(undefined);
  draftTextRef.current = draftText;
  const [draftArrow, setDraftArrow] = useState<DraftCanvasArrow>();
  const pendingArrowCreatesRef = useRef(new Map<string, Promise<string>>());
  const resolveArrowObjectId = useCallback(async (objectId: string) => {
    return (await pendingArrowCreatesRef.current.get(objectId)) ?? objectId;
  }, []);
  const arrowPointerStartRef = useRef<XYPosition | undefined>(undefined);
  const handledCreationRequestRef = useRef<number | undefined>(undefined);
  const activeTool = useTransientStore(
    (state) => state.canvasTools[boardKey] ?? "select",
  );
  const creationRequest = useTransientStore(
    (state) => state.canvasCreationRequests[boardKey],
  );
  const setCanvasTool = useTransientStore((state) => state.setCanvasTool);
  const { mutate: createCanvasTextMutation } = useCreateCanvasText(
    workspaceSlug,
    collectionSlug,
  );
  const { mutateAsync: createCanvasArrowMutation } = useCreateCanvasArrow(
    workspaceSlug,
    collectionSlug,
  );
  const { mutate: updateCanvasTextMutation } = useUpdateCanvasText(
    workspaceSlug,
    collectionSlug,
    folderPath,
  );
  const { mutate: updateCanvasArrowMutation } = useUpdateCanvasArrow(
    workspaceSlug,
    collectionSlug,
    folderPath,
    resolveArrowObjectId,
  );
  const { mutate: updateCanvasItemFrontIndexesMutation } =
    useUpdateCanvasItemFrontIndexes(workspaceSlug, collectionSlug, folderPath);
  const { mutate: deleteCanvasObjectMutation } = useDeleteCanvasObject(
    workspaceSlug,
    collectionSlug,
    folderPath,
  );
  const actionRefs = useRef<ActionRefs>({
    onOpenFolder,
    onOpenImage,
    onOpenColor,
    onOpenNote,
    onOpenVideo,
  });
  actionRefs.current = {
    onOpenFolder,
    onOpenImage,
    onOpenColor,
    onOpenNote,
    onOpenVideo,
  };
  const selectedIds = useMemo(
    () => selectionIdsForScope(selection, boardKey),
    [boardKey, selection],
  );
  const focusedCanvasObjectId = activeCanvasObjectFocus(
    canvasObjectFocus?.boardKey === boardKey
      ? canvasObjectFocus.objectId
      : undefined,
    selectedIds,
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canMoveSelection = selectedIds.every((id) =>
    PERSISTED_CANVAS_ITEM_ID.test(id),
  );
  const layoutableIds = useMemo(
    () =>
      new Set([
        ...nodes.map((node) => node.id),
        ...canvasObjects.flatMap((object) =>
          object.type === "text" ? [object.id] : [],
        ),
      ]),
    [canvasObjects, nodes],
  );
  const layoutableSelectionCount = selectedIds.filter((id) =>
    layoutableIds.has(id),
  ).length;
  const moveSource = useMemo(() => {
    if (!moveDialogOpen) return undefined;
    const currentNodes = getNodes();
    const selected = new Set(selectedIds);
    return {
      workspaceSlug,
      sourceCollectionSlug: collectionSlug,
      sourceFolderPath: folderPath,
      nodeIds: selectedIds,
      measurements: currentNodes.flatMap((node) =>
        selected.has(node.id) && node.measured?.width && node.measured?.height
          ? [
              {
                id: node.id,
                width: node.measured.width,
                height: node.measured.height,
                position: roundPosition(node.position),
              },
            ]
          : [],
      ),
      arrowSnapshots: getArrowSnapshots(canvasObjects, currentNodes),
      includedArrowIds: getInternalArrowIds(canvasObjects, selected),
    };
  }, [
    canvasObjects,
    collectionSlug,
    folderPath,
    getNodes,
    moveDialogOpen,
    selectedIds,
    workspaceSlug,
  ]);
  const selectionRef = useRef({ selectedIds: selectedIdSet, count: 0 });
  selectionRef.current = {
    selectedIds: selectedIdSet,
    count: selectedIds.length,
  };
  const eligibleNodeIdsKey = useMemo(() => {
    const ids = nodes
      .filter(
        (node) =>
          isPersistedSelectableAsset(node) &&
          !(
            isColorFilterActive &&
            node.type !== "folder" &&
            !colorMatchNodeIds?.has(node.id)
          ),
      )
      .map((node) => node.id);
    ids.push(...canvasObjects.map((object) => object.id));
    if (draftText) ids.push(draftText.id);
    return ids.join("\u001f");
  }, [canvasObjects, colorMatchNodeIds, draftText, isColorFilterActive, nodes]);
  const eligibleNodeIds = useMemo(
    () => new Set(eligibleNodeIdsKey ? eligibleNodeIdsKey.split("\u001f") : []),
    [eligibleNodeIdsKey],
  );
  const marquee = useMarqueeSelection({
    surfaceRef: boardRef,
    eligibleNodeIds,
    onReplace: (nodeIds) => {
      setCanvasObjectFocus(undefined);
      replaceSelection(boardKey, nodeIds);
    },
    shouldStart: (event) =>
      activeTool === "select" &&
      (!(event.target instanceof Element) ||
        !event.target.closest(
          ".react-flow__node, [data-selection-node-id], [data-arrow-control]",
        )),
    stopNativeEvents: true,
  });

  const handleBulkDelete = useCallback(() => {
    setCanvasObjectFocus(undefined);
    const pendingArrowIds = selectedIds.filter((id) =>
      id.startsWith("arrow-draft-"),
    );
    for (const objectId of pendingArrowIds) {
      const creation = pendingArrowCreatesRef.current.get(objectId);
      if (!creation) continue;
      void creation
        .then((persistedId) => {
          deleteCanvasObjectMutation(persistedId, {
            onError: () => toast.error("Unable to delete the canvas object."),
          });
        })
        .catch(() => undefined);
    }
    const persistedIds = selectedIds.filter(
      (id) => !id.startsWith("text-draft-") && !id.startsWith("arrow-draft-"),
    );
    if (persistedIds.length === 0) {
      setDraftText(undefined);
      setEditingTextId(undefined);
      clearSelection(boardKey);
      return;
    }
    bulkDelete.mutate(
      { nodeIds: persistedIds, collectionSlug },
      {
        onSuccess: () => {
          setDraftText(undefined);
          setEditingTextId(undefined);
          clearSelection(boardKey);
        },
      },
    );
  }, [
    boardKey,
    bulkDelete,
    clearSelection,
    collectionSlug,
    deleteCanvasObjectMutation,
    selectedIds,
  ]);

  const deleteCanvasObject = useCallback(
    (objectId: string) => {
      setCanvasObjectFocus(undefined);
      if (objectId.startsWith("text-draft-")) {
        setDraftText(undefined);
        setEditingTextId(undefined);
        clearSelection(boardKey);
        return;
      }
      if (objectId.startsWith("arrow-draft-")) {
        setEditingArrowId(undefined);
        clearSelection(boardKey);
        const creation = pendingArrowCreatesRef.current.get(objectId);
        if (creation) {
          void creation
            .then((persistedId) => {
              deleteCanvasObjectMutation(persistedId, {
                onError: () =>
                  toast.error("Unable to delete the canvas object."),
              });
            })
            .catch(() => undefined);
        }
        return;
      }
      deleteCanvasObjectMutation(objectId, {
        onSuccess: () => clearSelection(boardKey),
        onError: () => toast.error("Unable to delete the canvas object."),
      });
    },
    [boardKey, clearSelection, deleteCanvasObjectMutation],
  );

  const publishVisibleBounds = useCallback(
    (viewport: Viewport) => {
      const board = boardRef.current;
      if (!board) return;

      const { width, height } = board.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      boardSizeRef.current = { width, height };

      const { x, y, zoom } = viewport;
      setBoardVisibleBounds(boardKey, {
        left: (BOARD_VIEWPORT_INSET - x) / zoom,
        top: (BOARD_VIEWPORT_INSET - y) / zoom,
        right: (width - BOARD_VIEWPORT_INSET - x) / zoom,
        bottom: (height - BOARD_VIEWPORT_INSET - y) / zoom,
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
      for (const object of canvasObjects) {
        if (object.type !== "text" || !selectedIdSet.has(object.id)) continue;
        const flowNode = flowNodesById.get(object.id);
        selectedNodes.push({
          ...object,
          position: flowNode?.position ?? object.position,
          layoutWidth: flowNode?.measured?.width,
          layoutHeight: flowNode?.measured?.height,
        });
      }

      if (selectedNodes.length < 2) return;

      const targetPositions = layout(selectedNodes);
      const startPositions = new Map(
        selectedNodes.map((node) => [node.id, node.position ?? { x: 0, y: 0 }]),
      );
      const targetPositionMap = new Map(
        selectedNodes.map((node, index) => [node.id, targetPositions[index]!]),
      );
      const fullDeltas = new Map(
        selectedNodes.map((node) => {
          const start = startPositions.get(node.id)!;
          const target = targetPositionMap.get(node.id)!;
          return [
            node.id,
            { x: target.x - start.x, y: target.y - start.y },
          ] as const;
        }),
      );
      const arrowSnapshots = getArrowSnapshots(canvasObjects, currentFlowNodes);
      const arrowUpdates = getLayoutArrowUpdates(
        canvasObjects,
        arrowSnapshots,
        fullDeltas,
      );
      const items: UpdateCanvasItemsGeometryInput["items"] = [
        ...selectedNodes.map((node) => ({
          type: node.type === "text" ? ("text" as const) : ("node" as const),
          id: node.id,
          position: targetPositionMap.get(node.id)!,
        })),
        ...arrowUpdates.map(({ id, start, end, points, rotation }) => ({
          type: "arrow" as const,
          id,
          start,
          end,
          points,
          rotation,
        })),
      ];

      let cancelled = false;
      let finished = false;
      let settled = false;
      const clearPreviewWhenReady = () => {
        if (finished && settled) setGroupArrowPreviews(undefined);
      };
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
        const previewDeltas = new Map(
          [...fullDeltas].map(([id, delta]) => [
            id,
            { x: delta.x * eased, y: delta.y * eased },
          ]),
        );
        setGroupArrowPreviews(
          Object.fromEntries(
            getLayoutArrowUpdates(
              canvasObjects,
              arrowSnapshots,
              previewDeltas,
            ).map(({ id, ...geometry }) => [id, geometry]),
          ),
        );

        if (progress < 1) {
          requestAnimationFrame((t) => animate(t, startTime));
        } else {
          finished = true;
          clearPreviewWhenReady();
        }
      }

      requestAnimationFrame((t) => animate(t, t));

      const rollback = () => {
        cancelled = true;
        setFlowNodes((current) =>
          selectedNodes.reduce((next, node) => {
            const original = node.position;
            return original
              ? updateLocalNodePosition(next, node.id, original)
              : next;
          }, current),
        );
        setGroupArrowPreviews(undefined);
      };
      updateItemsGeometry.mutate(
        { folderPath, expectedParentFolderNodeId, items },
        {
          onError: rollback,
          onSettled: () => {
            settled = true;
            clearPreviewWhenReady();
          },
        },
      );
    },
    [
      folderPath,
      expectedParentFolderNodeId,
      canvasObjects,
      nodes,
      selectedIdSet,
      getNodes,
      updateItemsGeometry,
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
    (alignment: LinearLayoutAlignment) =>
      applySelectedNodeLayout((selectedNodes) =>
        makeNodesInRow(selectedNodes, alignment),
      ),
    [applySelectedNodeLayout],
  );
  const handleMakeColumn = useCallback(
    (alignment: LinearLayoutAlignment) =>
      applySelectedNodeLayout((selectedNodes) =>
        makeNodesInColumn(selectedNodes, alignment),
      ),
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

  useEffect(
    () => setBoardFlowPositionConverter(boardKey, screenToFlowPosition),
    [boardKey, screenToFlowPosition],
  );

  useEffect(
    () => setBoardViewportZoomReader(boardKey, () => getViewport().zoom),
    [boardKey, getViewport],
  );

  const startViewportInteraction = useCallback(() => {
    const now = performance.now();
    if (now - lastViewportActivityAtRef.current < 120) return;
    lastViewportActivityAtRef.current = now;
    notifyCanvasViewportActivity(boardKey);
  }, [boardKey, notifyCanvasViewportActivity]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || !event.cancelable) return;

      const board = boardRef.current;
      if (!board) return;
      const bounds = board.getBoundingClientRect();
      const pointerIsOnBoard =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      const menuBoardKey =
        event.target instanceof Element
          ? event.target
              .closest("[data-canvas-menu]")
              ?.getAttribute("data-canvas-menu")
          : undefined;
      if (!pointerIsOnBoard && menuBoardKey !== boardKey) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      const viewport = getViewport();
      const nextViewport = getCanvasWheelZoomViewport({
        viewport,
        pointer: {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        },
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        minZoom: CANVAS_MIN_ZOOM,
        maxZoom: CANVAS_MAX_ZOOM,
        pinchBoost:
          event.ctrlKey && navigator.userAgent.includes("Mac") ? 10 : 1,
      });
      if (nextViewport.zoom === viewport.zoom) return;

      startViewportInteraction();
      void setViewport(nextViewport);
    };

    window.addEventListener("wheel", handleWheel, {
      capture: true,
      passive: false,
    });
    return () => window.removeEventListener("wheel", handleWheel, true);
  }, [boardKey, getViewport, setViewport, startViewportInteraction]);

  const zoomInCanvas = useCallback(() => {
    startViewportInteraction();
    const viewport = getViewport();
    const zoom = Math.min(
      CANVAS_MAX_ZOOM,
      (Math.round(viewport.zoom * 100) + 10) / 100,
    );
    void zoomTo(zoom, { duration: VIEWPORT_ANIMATION_DURATION });
  }, [getViewport, startViewportInteraction, zoomTo]);

  const zoomOutCanvas = useCallback(() => {
    startViewportInteraction();
    const viewport = getViewport();
    const zoom = Math.max(
      CANVAS_MIN_ZOOM,
      (Math.round(viewport.zoom * 100) - 10) / 100,
    );
    void zoomTo(zoom, { duration: VIEWPORT_ANIMATION_DURATION });
  }, [getViewport, startViewportInteraction, zoomTo]);

  const setZoomCanvas = useCallback(
    (nextZoom: number) => {
      startViewportInteraction();
      const zoom = Math.min(
        CANVAS_MAX_ZOOM,
        Math.max(CANVAS_MIN_ZOOM, nextZoom),
      );
      void zoomTo(zoom, { duration: VIEWPORT_ANIMATION_DURATION });
    },
    [startViewportInteraction, zoomTo],
  );

  const fitCanvasView = useCallback(() => {
    startViewportInteraction();
    void fitView({
      padding: 0.18,
      maxZoom: FIT_VIEW_MAX_ZOOM,
      duration: VIEWPORT_ANIMATION_DURATION,
    });
  }, [fitView, startViewportInteraction]);

  const canvasActionsRef = useCanvasActions();

  useImperativeHandle(
    canvasActionsRef,
    () => ({
      zoomIn: zoomInCanvas,
      zoomOut: zoomOutCanvas,
      setZoom: setZoomCanvas,
      fitView: fitCanvasView,
    }),
    [fitCanvasView, setZoomCanvas, zoomInCanvas, zoomOutCanvas],
  );

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
  const openColor = useCallback(
    (node: Extract<CollectionNode, { type: "color" }>) =>
      actionRefs.current.onOpenColor(node),
    [],
  );
  const openNote = useCallback(
    (node: Extract<CollectionNode, { type: "note" }>, mode?: "read" | "edit") =>
      actionRefs.current.onOpenNote(node, mode),
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
      setCanvasObjectFocus(undefined);
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
  const beginTextDraft = useCallback(
    (position: XYPosition) => {
      const id = `text-draft-${Date.now()}`;
      setCanvasObjectFocus(undefined);
      clearSelection(boardKey);
      setCanvasTool(boardKey, "select");
      setDraftText({
        id,
        type: "text",
        content: "",
        position: roundPosition(position),
        font: "inter",
        size: "md",
        color: "ink",
        frontIndex: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: id,
      });
      setEditingTextId(id);
    },
    [boardKey, clearSelection, setCanvasTool],
  );
  const handleTextSelect = useCallback(
    (objectId: string, event: ReactMouseEvent) => {
      if (hasSelectionModifier(event)) {
        setCanvasObjectFocus(undefined);
        toggleSelectedNode(boardKey, objectId);
      } else if (selectedIds.length > 1 && selectedIdSet.has(objectId)) {
        return;
      } else {
        setCanvasObjectFocus({ boardKey, objectId });
        replaceSelection(boardKey, [objectId]);
      }
      event.stopPropagation();
    },
    [
      boardKey,
      replaceSelection,
      selectedIdSet,
      selectedIds.length,
      toggleSelectedNode,
    ],
  );
  const handleTextPointerDown = useCallback(
    (objectId: string, event: React.PointerEvent) => {
      if (event.button !== 0 || hasSelectionModifier(event)) return;
      if (selectedIds.length > 1 && selectedIdSet.has(objectId)) return;
      setCanvasObjectFocus({ boardKey, objectId });
      replaceSelection(boardKey, [objectId]);
    },
    [boardKey, replaceSelection, selectedIdSet, selectedIds.length],
  );
  const commitText = useCallback(
    (objectId: string, content: string) => {
      const trimmed = content.trim();
      if (objectId.startsWith("text-draft-")) {
        const draft = draftText;
        if (!draft || draft.id !== objectId) return;
        if (!trimmed) {
          setDraftText(undefined);
          setEditingTextId(undefined);
          clearSelection(boardKey);
          return;
        }
        setDraftText((current) =>
          current?.id === objectId ? { ...current, content } : current,
        );
        setEditingTextId(undefined);
        createCanvasTextMutation(
          {
            type: "text",
            content,
            position: draft.position,
            font: draft.font,
            size: draft.size,
            color: draft.color,
            parentFolderPath: folderPath,
            clientId: draft.clientId,
          },
          {
            onSuccess: ({ object }) => {
              const currentDraft = draftTextRef.current;
              clearSelection(boardKey);
              if (
                currentDraft?.id === objectId &&
                !positionsEqual(currentDraft.position, draft.position)
              ) {
                updateCanvasTextMutation({
                  objectId: object.id,
                  position: currentDraft.position,
                });
              }
            },
            onError: () => {
              setDraftText(undefined);
              setEditingTextId(undefined);
              toast.error("Unable to create canvas text.");
            },
          },
        );
        return;
      }
      setEditingTextId(undefined);
      if (!trimmed) return;
      updateCanvasTextMutation(
        { objectId, content },
        { onError: () => toast.error("Unable to update canvas text.") },
      );
    },
    [
      boardKey,
      clearSelection,
      createCanvasTextMutation,
      draftText,
      folderPath,
      updateCanvasTextMutation,
    ],
  );
  const updateTextStyle = useCallback(
    (
      objectId: string,
      update: Partial<Pick<CanvasTextObject, "font" | "size" | "color">>,
    ) => {
      if (objectId.startsWith("text-draft-")) {
        setDraftText((current) =>
          current?.id === objectId ? { ...current, ...update } : current,
        );
        return;
      }
      updateCanvasTextMutation({ objectId, ...update });
    },
    [updateCanvasTextMutation],
  );
  const updateArrowObject = useCallback(
    (
      objectId: string,
      update: Partial<
        Pick<
          CanvasArrowObject,
          | "start"
          | "end"
          | "style"
          | "pattern"
          | "head"
          | "routing"
          | "points"
          | "rotation"
          | "color"
        >
      >,
      callbacks?: { onSettled?: () => void },
    ) => {
      updateCanvasArrowMutation(
        { objectId, ...update },
        {
          onError: () => toast.error("Unable to update the arrow."),
          onSettled: callbacks?.onSettled,
        },
      );
    },
    [updateCanvasArrowMutation],
  );
  const findArrowBinding = useCallback(
    (position: XYPosition): CanvasArrowEndpoint => {
      const padding = 16 / getViewport().zoom;
      const target = getNodes()
        .map((node) => {
          const width = node.measured?.width ?? node.width ?? 0;
          const height = node.measured?.height ?? node.height ?? 0;
          const nearest = {
            x: Math.min(
              node.position.x + width,
              Math.max(node.position.x, position.x),
            ),
            y: Math.min(
              node.position.y + height,
              Math.max(node.position.y, position.y),
            ),
          };
          return {
            node,
            width,
            height,
            nearest,
            distance: Math.hypot(
              position.x - nearest.x,
              position.y - nearest.y,
            ),
          };
        })
        .filter((candidate) => candidate.distance <= padding)
        .sort((left, right) => left.distance - right.distance)[0];
      if (!target || target.width <= 0 || target.height <= 0) {
        return { position: roundPosition(position) };
      }
      return {
        position: roundPosition(target.nearest),
        binding: {
          targetId: target.node.id,
          anchor: {
            x: Math.min(
              1,
              Math.max(
                0,
                (target.nearest.x - target.node.position.x) / target.width,
              ),
            ),
            y: Math.min(
              1,
              Math.max(
                0,
                (target.nearest.y - target.node.position.y) / target.height,
              ),
            ),
          },
        },
      };
    },
    [getNodes, getViewport],
  );
  const createArrowBetween = useCallback(
    (start: XYPosition, end: XYPosition) => {
      setCanvasTool(boardKey, "select");
      const clientId = `arrow-draft-${crypto.randomUUID()}`;
      const arrow: DraftCanvasArrow = {
        start: findArrowBinding(start),
        end: findArrowBinding(end),
        style: "clean",
        pattern: "solid",
        head: "filled",
        routing: "straight",
        points: [],
        rotation: 0,
        color: "ink",
      };
      const creation = createCanvasArrowMutation({
        type: "arrow",
        ...arrow,
        parentFolderPath: folderPath,
        clientId,
      }).then(({ object }) => {
        if (object.type !== "arrow") {
          throw new Error("Expected the created canvas object to be an arrow");
        }
        setCanvasObjectFocus((current) =>
          current?.boardKey === boardKey && current.objectId === clientId
            ? { boardKey, objectId: object.id }
            : current,
        );
        setEditingArrowId((current) =>
          current === clientId ? object.id : current,
        );
        if (selectionRef.current.selectedIds.has(clientId)) {
          replaceSelection(
            boardKey,
            [...selectionRef.current.selectedIds].map((id) =>
              id === clientId ? object.id : id,
            ),
          );
        }
        return object.id;
      });
      pendingArrowCreatesRef.current.set(clientId, creation);
      setDraftArrow(undefined);
      setEditingArrowId(undefined);
      setCanvasObjectFocus({ boardKey, objectId: clientId });
      replaceSelection(boardKey, [clientId]);
      void creation.catch(() => {
        pendingArrowCreatesRef.current.delete(clientId);
        setCanvasObjectFocus((current) =>
          current?.boardKey === boardKey && current.objectId === clientId
            ? undefined
            : current,
        );
        setEditingArrowId((current) =>
          current === clientId ? undefined : current,
        );
        if (selectionRef.current.selectedIds.has(clientId)) {
          replaceSelection(
            boardKey,
            [...selectionRef.current.selectedIds].filter(
              (id) => id !== clientId,
            ),
          );
        }
        toast.error("Unable to create the arrow.");
      });
    },
    [
      boardKey,
      createCanvasArrowMutation,
      findArrowBinding,
      folderPath,
      replaceSelection,
      setCanvasTool,
    ],
  );
  const handleArrowSelect = useCallback(
    (objectId: string, event: ReactMouseEvent) => {
      setEditingArrowId((current) =>
        current === objectId ? current : undefined,
      );
      if (hasSelectionModifier(event)) {
        setCanvasObjectFocus(undefined);
        toggleSelectedNode(boardKey, objectId);
      } else if (selectedIds.length > 1 && selectedIdSet.has(objectId)) {
        return;
      } else {
        setCanvasObjectFocus({ boardKey, objectId });
        replaceSelection(boardKey, [objectId]);
      }
      event.stopPropagation();
    },
    [
      boardKey,
      replaceSelection,
      selectedIdSet,
      selectedIds.length,
      toggleSelectedNode,
    ],
  );
  const handleArrowFocus = useCallback(
    (objectId: string) => {
      setEditingArrowId((current) =>
        current === objectId ? current : undefined,
      );
      setCanvasObjectFocus({ boardKey, objectId });
      replaceSelection(boardKey, [objectId]);
    },
    [boardKey, replaceSelection],
  );

  useEffect(() => {
    if (
      !creationRequest ||
      handledCreationRequestRef.current === creationRequest.id
    ) {
      return;
    }
    handledCreationRequestRef.current = creationRequest.id;
    const viewport = getViewport();
    const size = boardSizeRef.current;
    const position =
      creationRequest.position ??
      roundPosition({
        x: (size.width / 2 - viewport.x) / viewport.zoom,
        y: (size.height / 2 - viewport.y) / viewport.zoom,
      });
    if (creationRequest.tool === "text") {
      beginTextDraft(position);
    } else {
      createArrowBetween(position, { x: position.x + 160, y: position.y });
    }
  }, [beginTextDraft, createArrowBetween, creationRequest, getViewport]);
  const clearAlignmentGuides = useCallback(() => {
    setAlignmentGuides((current) =>
      current === undefined ? current : undefined,
    );
  }, []);
  const setActiveAlignmentGuides = useCallback(
    (next: CanvasAlignmentGuides | undefined) => {
      setAlignmentGuides((current) =>
        alignmentGuidesEqual(current, next) ? current : next,
      );
    },
    [],
  );
  const clearDropTarget = useCallback(() => {
    dropTargetNodeIdRef.current = undefined;
    dropStackStylesRef.current = new Map();
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
        setCanvasObjectFocus(undefined);
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
        boardKey,
        deleteContext: {
          workspaceSlug,
          collectionSlug,
          folderPath,
          expectedParentFolderNodeId,
        },
        onOpenFolder: openFolder,
        onOpenImage: openImage,
        onOpenColor: openColor,
        onOpenNote: openNote,
        onOpenVideo: actionRefs.current.onOpenVideo,
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
          ? pendingFolderDrop.nodeIds[0]
          : isHoveredDropTarget
            ? dragSessionRef.current?.primaryNodeId
            : undefined,
        incomingDropCount: isPendingDropTarget
          ? pendingFolderDrop.nodeIds.length
          : isHoveredDropTarget
            ? dragSessionRef.current?.origins.size
            : undefined,
        dropStackStyle: dropStackStylesRef.current.get(collectionNode.id),
        onContextMenu: handleNodeContextMenu,
      };
    },
    [
      boardKey,
      collectionSlug,
      colorMatchNodeIds,
      dropTargetNodeId,
      expectedParentFolderNodeId,
      folderPath,
      focusedNodeId,
      isColorFilterActive,
      openFolder,
      openColor,
      openImage,
      openNote,
      pendingFolderDrop,
      suppressClick,
      workspaceSlug,
      handleNodeContextMenu,
      handleCardClick,
    ],
  );

  const makeTextNodeData = useCallback(
    (object: CanvasTextObject): CanvasTextNodeData => ({
      object,
      editing: editingTextId === object.id,
      onSelect: handleTextSelect,
      onPointerDown: handleTextPointerDown,
      onBeginEdit: (id) => {
        setCanvasObjectFocus(undefined);
        clearSelection(boardKey);
        setEditingTextId(id);
      },
      onCommit: commitText,
    }),
    [
      boardKey,
      clearSelection,
      commitText,
      editingTextId,
      handleTextPointerDown,
      handleTextSelect,
    ],
  );
  const focusedInspectorTarget = useMemo<
    CanvasInspectorTarget | undefined
  >(() => {
    if (!focusedCanvasObjectId) return undefined;
    const object = canvasObjects.find(
      (candidate) =>
        candidate.id === focusedCanvasObjectId ||
        (candidate.type === "arrow" &&
          arrowHasIdentity(candidate, focusedCanvasObjectId)),
    );
    if (!object) return undefined;
    if (object.type === "arrow") {
      return {
        type: "arrow",
        object,
        pointEditing: arrowHasIdentity(object, editingArrowId),
        onUpdate: updateArrowObject,
        onDelete: deleteCanvasObject,
      };
    }
    if (object.type === "text") {
      return {
        type: "text",
        object,
        onUpdate: updateTextStyle,
        onDelete: deleteCanvasObject,
      };
    }
    return undefined;
  }, [
    canvasObjects,
    deleteCanvasObject,
    editingArrowId,
    focusedCanvasObjectId,
    updateArrowObject,
    updateTextStyle,
  ]);

  const [flowNodes, setFlowNodes] = useState<CanvasFlowNode[]>(() => [
    ...nodes.map((node, index) =>
      makeFlowNode(
        node,
        index,
        makeNodeData(node),
        expandedNoteOrderRef.current,
      ),
    ),
    ...canvasObjects
      .filter((object): object is CanvasTextObject => object.type === "text")
      .map((object) => makeTextFlowNode(object, makeTextNodeData(object))),
  ]);
  const editingTextNode = editingTextId
    ? flowNodes.find(
        (node): node is CanvasTextFlowNode =>
          node.type === "text" && node.id === editingTextId,
      )
    : undefined;

  useEffect(() => {
    let timer: number | undefined;

    const unsubscribe = onBatchPlacementCompleted((placement) => {
      if (placement.boardKey !== boardKey) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const visibleBounds =
          useTransientStore.getState().boardVisibleBounds[boardKey];
        if (!visibleBounds) return;

        const { bounds } = placement;
        const exceedsViewport =
          bounds.left < visibleBounds.left ||
          bounds.top < visibleBounds.top ||
          bounds.right > visibleBounds.right ||
          bounds.bottom > visibleBounds.bottom;
        if (!exceedsViewport) return;

        const nodeIds = new Set(placement.nodeIds);
        const batchNodes = getNodes().filter((node) => nodeIds.has(node.id));
        if (batchNodes.length === 0) return;

        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        void fitView({
          nodes: batchNodes,
          padding: 0.12,
          maxZoom: getViewport().zoom,
          duration: reducedMotion ? 0 : 180,
        });
      }, 180);
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [boardKey, fitView, getNodes, getViewport]);

  useEffect(() => {
    activateSelectionScope(boardKey);
  }, [activateSelectionScope, boardKey]);

  useEffect(() => {
    if (selection.scopeKey !== boardKey) return;
    const retainedIds = selectedIds.filter((nodeId) =>
      eligibleNodeIds.has(nodeId),
    );
    if (retainedIds.length === selectedIds.length) return;
    replaceSelection(boardKey, retainedIds);
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
      const canvasAction = getCanvasViewShortcutAction(event);
      if (canvasAction) {
        event.preventDefault();
        if (canvasAction === "zoom-in") zoomInCanvas();
        if (canvasAction === "zoom-out") zoomOutCanvas();
        if (canvasAction === "fit-view") fitCanvasView();
        return;
      }
      if (event.key === "Escape") {
        if (editingArrowId) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setEditingArrowId(undefined);
          return;
        }
        setCanvasTool(boardKey, "select");
        setDraftArrow(undefined);
        arrowPointerStartRef.current = undefined;
        setCanvasObjectFocus(undefined);
        clearSelection(boardKey);
        return;
      }
      if (isSelectionShortcut(event)) {
        event.preventDefault();
        setCanvasObjectFocus(undefined);
        replaceSelection(boardKey, eligibleNodeIds);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    boardKey,
    clearSelection,
    editingArrowId,
    eligibleNodeIds,
    fitCanvasView,
    replaceSelection,
    setCanvasTool,
    zoomInCanvas,
    zoomOutCanvas,
  ]);

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
    const expandedNoteOrder = updateExpandedNoteOrder(
      expandedNoteOrderRef.current,
      nodes,
    );
    expandedNoteOrderRef.current = expandedNoteOrder;

    setFlowNodes((current) => {
      const currentById = new Map(current.map((node) => [node.id, node]));
      const currentByClientId = new Map<string, CanvasFlowNode>();
      current.forEach((node) => {
        if (node.type === "asset") {
          const clientId = getNodeClientId(node.data.collectionNode);
          if (clientId) currentByClientId.set(clientId, node);
        } else if (node.type === "text") {
          const clientId = node.data.object.clientId;
          if (clientId) currentByClientId.set(clientId, node);
        }
      });

      const assetNodes = nodes.map((node, index) =>
        makeFlowNode(
          node,
          index,
          makeNodeData(node),
          expandedNoteOrder,
          (currentById.get(node.id) ??
            currentByClientId.get(getNodeClientId(node) ?? "")) as
            | CanvasNode
            | undefined,
        ),
      );
      const textObjects = canvasObjects.filter(
        (object): object is CanvasTextObject => object.type === "text",
      );
      if (
        draftText &&
        !textObjects.some((object) => object.clientId === draftText.clientId)
      ) {
        textObjects.push(draftText);
      }
      const textNodes = textObjects.map((object) =>
        makeTextFlowNode(
          object,
          makeTextNodeData(object),
          (currentById.get(object.id) ??
            currentByClientId.get(object.clientId ?? "")) as
            | CanvasTextFlowNode
            | undefined,
        ),
      );
      return [...assetNodes, ...textNodes];
    });
  }, [canvasObjects, draftText, makeNodeData, makeTextNodeData, nodes]);

  useEffect(() => {
    if (
      draftText &&
      canvasObjects.some(
        (object) =>
          object.type === "text" && object.clientId === draftText.clientId,
      )
    ) {
      setDraftText(undefined);
    }
  }, [canvasObjects, draftText]);

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
  }, [fitView, focusRequestId, focusedNodeId, getNode]);

  const previewTranslatedArrows = useCallback(
    (
      snapshots: ArrowSnapshot[],
      movingIds: ReadonlySet<string>,
      delta: XYPosition,
    ) => {
      const updates = getTranslatedArrowUpdates(
        canvasObjects,
        snapshots,
        movingIds,
        delta,
      );
      setGroupArrowPreviews(
        Object.fromEntries(
          updates.map(({ id, ...geometry }) => [id, geometry]),
        ),
      );
    },
    [canvasObjects],
  );

  const saveGroupGeometry = useCallback(
    (
      origins: Map<string, XYPosition>,
      movingIds: ReadonlySet<string>,
      snapshots: ArrowSnapshot[],
      delta: XYPosition,
    ) => {
      const nodeItems: UpdateCanvasItemsGeometryInput["items"] = [
        ...origins.entries(),
      ].flatMap<UpdateCanvasItemsGeometryInput["items"][number]>(
        ([id, origin]) => {
          const position = roundPosition({
            x: origin.x + delta.x,
            y: origin.y + delta.y,
          });
          if (/^(folder|image|note|link|color)-\d+$/.test(id)) {
            return [{ type: "node" as const, id, position }];
          }
          if (/^text-\d+$/.test(id)) {
            return [{ type: "text" as const, id, position }];
          }
          if (id.startsWith("text-draft-")) {
            setDraftText((current) =>
              current?.id === id ? { ...current, position } : current,
            );
          }
          return [];
        },
      );
      const arrowItems: UpdateCanvasItemsGeometryInput["items"] =
        getTranslatedArrowUpdates(canvasObjects, snapshots, movingIds, delta)
          .filter(({ id }) => /^arrow-\d+$/.test(id))
          .map(({ id, start, end, points, rotation }) => ({
            type: "arrow",
            id,
            start,
            end,
            points,
            rotation,
          }));
      const items = [...nodeItems, ...arrowItems];
      if (items.length === 0) {
        setGroupArrowPreviews(undefined);
        return;
      }
      updateItemsGeometry.mutate(
        { folderPath, expectedParentFolderNodeId, items },
        {
          onError: () => {
            setFlowNodes((current) =>
              [...origins.entries()].reduce(
                (next, [id, origin]) =>
                  updateLocalNodePosition(next, id, origin),
                current,
              ),
            );
          },
          onSettled: () => setGroupArrowPreviews(undefined),
        },
      );
    },
    [
      canvasObjects,
      expectedParentFolderNodeId,
      folderPath,
      updateItemsGeometry,
    ],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const dragSession = dragSessionRef.current;
      const primaryChange = dragSession
        ? getPositionChange(changes, dragSession.primaryNodeId)
        : undefined;

      if (
        !areAlignmentGuidesEnabled ||
        !dragSession ||
        !primaryChange?.position ||
        alignmentBypassRef.current ||
        dropTargetNodeIdRef.current
      ) {
        clearAlignmentGuides();
        if (dragSession) {
          recordDraggedChangePositions(dragSession, changes);
          const origin = dragSession.origins.get(dragSession.primaryNodeId);
          const current = dragSession.currentPositions.get(
            dragSession.primaryNodeId,
          );
          if (origin && current) {
            previewTranslatedArrows(
              dragSession.arrowSnapshots,
              dragSession.movingIds,
              { x: current.x - origin.x, y: current.y - origin.y },
            );
          }
        }
        setFlowNodes((current) => applyNodeChanges(changes, current));
        return;
      }

      const primaryOrigin = dragSession.draggedRects.get(
        dragSession.primaryNodeId,
      );
      if (!primaryOrigin) {
        clearAlignmentGuides();
        recordDraggedChangePositions(dragSession, changes);
        setFlowNodes((current) => applyNodeChanges(changes, current));
        return;
      }

      const dragOffset = {
        x: primaryChange.position.x - primaryOrigin.x,
        y: primaryChange.position.y - primaryOrigin.y,
      };
      const movingBounds = getCanvasAlignmentBounds(
        Array.from(dragSession.draggedRects.values(), (rectangle) => ({
          ...rectangle,
          x: rectangle.x + dragOffset.x,
          y: rectangle.y + dragOffset.y,
        })),
      );
      const viewport = getViewport();
      const visibleBounds = getCanvasViewportBounds(
        boardSizeRef.current,
        viewport,
      );
      const snap = movingBounds
        ? getCanvasAlignmentSnap({
            moving: movingBounds,
            candidates: getVisibleCanvasAlignmentRects(
              dragSession.alignmentCandidates,
              visibleBounds,
            ),
            zoom: viewport.zoom,
          })
        : undefined;

      setActiveAlignmentGuides(snap?.guides);
      const adjustedChanges = withAlignedDragPositions(
        changes,
        dragSession,
        {
          x: dragOffset.x + (snap?.offset.x ?? 0),
          y: dragOffset.y + (snap?.offset.y ?? 0),
        },
        primaryChange.dragging,
      );
      setDraggedPositions(dragSession, {
        x: dragOffset.x + (snap?.offset.x ?? 0),
        y: dragOffset.y + (snap?.offset.y ?? 0),
      });
      previewTranslatedArrows(
        dragSession.arrowSnapshots,
        dragSession.movingIds,
        {
          x: dragOffset.x + (snap?.offset.x ?? 0),
          y: dragOffset.y + (snap?.offset.y ?? 0),
        },
      );
      setFlowNodes((current) => applyNodeChanges(adjustedChanges, current));
    },
    [
      areAlignmentGuidesEnabled,
      clearAlignmentGuides,
      getViewport,
      previewTranslatedArrows,
      setActiveAlignmentGuides,
    ],
  );
  const updateDropTarget = useCallback(
    (event: MouseEvent | TouchEvent, node?: CanvasFlowNode) => {
      const movingIds =
        dragSessionRef.current?.movingIds ??
        arrowGroupDragRef.current?.movingIds;
      if (
        (node?.type === "asset" && !isDraggableNode(node)) ||
        (node?.type === "text" && node.id.startsWith("text-draft-")) ||
        (movingIds &&
          [...movingIds].some((id) => !PERSISTED_CANVAS_ITEM_ID.test(id)))
      ) {
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
            !dragSessionRef.current?.origins.has(candidate.id) &&
            !arrowGroupDragRef.current?.movingIds.has(candidate.id) &&
            candidate.type === "asset" &&
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
      if (nextTargetId) clearAlignmentGuides();
      const dragSession = dragSessionRef.current;
      dropStackStylesRef.current =
        nextTargetId && dragSession
          ? makeCanvasDropStackStyles(
              dragSession.primaryNodeId,
              dragSession.origins,
            )
          : new Map();
      setDropTargetNodeId(nextTargetId);
    },
    [
      clearAlignmentGuides,
      clearDropTarget,
      getIntersectingNodes,
      getNodes,
      screenToFlowPosition,
    ],
  );

  const beginArrowGroupDrag = useCallback(
    (arrowId: string) => {
      if (!/^arrow-\d+$/.test(arrowId)) {
        return false;
      }
      const movingSelection = selectedIdSet.has(arrowId)
        ? selectedIds
        : [arrowId];
      const currentNodes = getNodes();
      const origins = new Map(
        currentNodes
          .filter((node) => movingSelection.includes(node.id))
          .map((node) => [node.id, { ...node.position }] as const),
      );
      arrowGroupDragRef.current = {
        origins,
        movingIds: new Set(movingSelection),
        arrowSnapshots: getArrowSnapshots(canvasObjects, currentNodes),
      };
      return true;
    },
    [canvasObjects, getNodes, selectedIdSet, selectedIds],
  );
  const moveArrowGroupDrag = useCallback(
    (delta: XYPosition, event: PointerEvent) => {
      const session = arrowGroupDragRef.current;
      if (!session) return;
      setFlowNodes((current) =>
        current.map((node) => {
          const origin = session.origins.get(node.id);
          return origin
            ? {
                ...node,
                position: {
                  x: origin.x + delta.x,
                  y: origin.y + delta.y,
                },
              }
            : node;
        }),
      );
      previewTranslatedArrows(session.arrowSnapshots, session.movingIds, delta);
      updateDropTarget(event);
    },
    [previewTranslatedArrows, updateDropTarget],
  );
  const cancelArrowGroupDrag = useCallback(() => {
    const session = arrowGroupDragRef.current;
    arrowGroupDragRef.current = undefined;
    if (session) {
      setFlowNodes((current) =>
        [...session.origins.entries()].reduce(
          (next, [id, origin]) => updateLocalNodePosition(next, id, origin),
          current,
        ),
      );
    }
    setGroupArrowPreviews(undefined);
    clearDropTarget();
  }, [clearDropTarget]);
  const endArrowGroupDrag = useCallback(
    (delta: XYPosition) => {
      const session = arrowGroupDragRef.current;
      arrowGroupDragRef.current = undefined;
      if (!session) return;
      const targetFolderNodeId = dropTargetNodeIdRef.current;
      clearDropTarget();
      if (
        targetFolderNodeId &&
        [...session.movingIds].every((id) => PERSISTED_CANVAS_ITEM_ID.test(id))
      ) {
        const nodeIds = [...session.movingIds];
        const currentNodes = getNodes();
        moveNodesToFolder.mutate(
          {
            nodeIds,
            folderPath,
            targetFolderNodeId,
            sourceCollectionSlug: collectionSlug,
            sourceFolderPath: folderPath,
            arrowSnapshots: session.arrowSnapshots,
            measurements: currentNodes.flatMap((node) =>
              session.movingIds.has(node.id) &&
              node.measured?.width &&
              node.measured?.height
                ? [
                    {
                      id: node.id,
                      width: node.measured.width,
                      height: node.measured.height,
                      position: roundPosition(
                        session.origins.get(node.id) ?? node.position,
                      ),
                    },
                  ]
                : [],
            ),
          },
          {
            onError: () =>
              setFlowNodes((current) =>
                [...session.origins.entries()].reduce(
                  (next, [id, origin]) =>
                    updateLocalNodePosition(next, id, origin),
                  current,
                ),
              ),
            onSettled: () => setGroupArrowPreviews(undefined),
          },
        );
        return;
      }
      saveGroupGeometry(
        session.origins,
        session.movingIds,
        session.arrowSnapshots,
        delta,
      );
    },
    [
      clearDropTarget,
      collectionSlug,
      folderPath,
      getNodes,
      moveNodesToFolder,
      saveGroupGeometry,
    ],
  );

  return (
    <div
      ref={boardRef}
      className={cn(
        "relative h-full min-h-0 w-full bg-transparent",
        activeTool === "text" && "cursor-text",
        activeTool === "arrow" && "cursor-crosshair",
      )}
      onPointerDownCapture={(event) => {
        if (focusRequestId !== undefined) onDismissFocusedNode?.();
        if (
          activeTool === "arrow" &&
          event.target instanceof Element &&
          event.target.closest(".react-flow__pane, .react-flow__node")
        ) {
          setCanvasObjectFocus(undefined);
          clearSelection(boardKey);
          const start = roundPosition(
            screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          );
          arrowPointerStartRef.current = start;
          setDraftArrow({
            start: { position: start },
            end: { position: start },
            style: "clean",
            pattern: "solid",
            head: "filled",
            routing: "straight",
            points: [],
            rotation: 0,
            color: "ink",
          });
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        marquee.onPointerDownCapture(event);
      }}
      onPointerMoveCapture={(event) => {
        const arrowStart = arrowPointerStartRef.current;
        if (arrowStart) {
          const end = roundPosition(
            screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          );
          setDraftArrow((current) =>
            current ? { ...current, end: { position: end } } : current,
          );
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        marquee.onPointerMoveCapture(event);
        alignmentBypassRef.current = event.altKey;
        setBoardPointerPosition(
          boardKey,
          roundPosition(
            screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          ),
        );
      }}
      onPointerUpCapture={(event) => {
        const start = arrowPointerStartRef.current;
        if (start) {
          arrowPointerStartRef.current = undefined;
          const end = roundPosition(
            screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          );
          if (Math.hypot(end.x - start.x, end.y - start.y) >= 8) {
            createArrowBetween(start, end);
          } else {
            setDraftArrow(undefined);
            setCanvasTool(boardKey, "select");
          }
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        marquee.onPointerUpCapture(event);
      }}
      onPointerCancelCapture={(event) => {
        arrowPointerStartRef.current = undefined;
        setDraftArrow(undefined);
        if (activeTool === "arrow") setCanvasTool(boardKey, "select");
        marquee.onPointerCancelCapture(event);
      }}
      onClickCapture={(event) => {
        marquee.consumeClick(event);
      }}
    >
      <CanvasToolCursorIndicator tool={activeTool} boardRef={boardRef} />
      <ReactFlow<CanvasFlowNode>
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
        nodesDraggable={!isCanvasLocked && activeTool === "select"}
        autoPanOnNodeDrag={!isCanvasLocked && activeTool === "select"}
        selectionKeyCode={["Control", "Meta"]}
        multiSelectionKeyCode={["Control", "Meta"]}
        zoomActivationKeyCode={null}
        selectionMode={SelectionMode.Full}
        selectionOnDrag={false}
        panOnDrag
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        onMoveStart={startViewportInteraction}
        onMoveEnd={(_, viewport) => {
          setStoredViewport(boardKey, viewport);
          publishVisibleBounds(viewport);
        }}
        onPaneContextMenu={(event) => {
          setCanvasObjectFocus(undefined);
          clearSelection(boardKey);
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          setInsertionPosition(boardKey, roundPosition(position));
        }}
        onPaneClick={(event) => {
          if (activeTool === "text") {
            beginTextDraft(
              screenToFlowPosition({ x: event.clientX, y: event.clientY }),
            );
            return;
          }
          setCanvasObjectFocus(undefined);
          clearSelection(boardKey);
        }}
        onNodeDragStart={(_, node, movedNodes) => {
          alignmentBypassRef.current = false;
          clearAlignmentGuides();
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
          const movingIds = new Set([
            ...draggedNodeIds,
            ...(selectedIdSet.has(node.id)
              ? canvasObjects.flatMap((object) =>
                  object.type === "arrow" && selectedIdSet.has(object.id)
                    ? [object.id]
                    : [],
                )
              : []),
          ]);
          const currentFlowNodes = getNodes();
          const currentFlowNodesById = new Map(
            currentFlowNodes.map((flowNode) => [flowNode.id, flowNode]),
          );
          const draggedRects = new Map(
            dragNodes.flatMap((dragNode) => {
              const flowNode =
                currentFlowNodesById.get(dragNode.id) ?? dragNode;
              const rectangle = toCanvasAlignmentRect(flowNode);
              return rectangle ? [[dragNode.id, rectangle] as const] : [];
            }),
          );
          const alignmentCandidates = areAlignmentGuidesEnabled
            ? currentFlowNodes.flatMap((flowNode) => {
                if (draggedNodeIds.has(flowNode.id)) return [];
                const rectangle = toCanvasAlignmentRect(flowNode);
                return rectangle ? [rectangle] : [];
              })
            : [];
          setFlowNodes((current) =>
            current.map((flowNode) =>
              draggedNodeIds.has(flowNode.id)
                ? { ...flowNode, zIndex: getCanvasInteractionZIndex() }
                : flowNode,
            ),
          );
          dragSessionRef.current = {
            primaryNodeId: node.id,
            origins: new Map(
              dragNodes.map((dragNode) => [
                dragNode.id,
                {
                  ...roundPosition(dragNode.position),
                  height: getCanvasCardHeight(dragNode),
                },
              ]),
            ),
            alignmentCandidates,
            currentPositions: new Map(
              dragNodes.map((dragNode) => [
                dragNode.id,
                roundPosition(dragNode.position),
              ]),
            ),
            draggedRects,
            isGroup: movingIds.size > 1,
            movingIds,
            arrowSnapshots: getArrowSnapshots(canvasObjects, currentFlowNodes),
          };
        }}
        onNodeDrag={(event, node) => {
          updateDropTarget(event, node);
        }}
        onNodeDragStop={(_, node, movedNodes) => {
          const session = dragSessionRef.current;
          const dragNodes = movedNodes.length > 0 ? movedNodes : [node];
          dragSessionRef.current = undefined;
          alignmentBypassRef.current = false;
          clearAlignmentGuides();
          const draggedNodeIds = new Set(
            dragNodes.map((dragNode) => dragNode.id),
          );
          setFlowNodes((current) =>
            current.map((flowNode) =>
              draggedNodeIds.has(flowNode.id)
                ? {
                    ...flowNode,
                    zIndex:
                      flowNode.type === "asset"
                        ? getCanvasRestingZIndex(
                            flowNode.data.collectionNode,
                            expandedNoteOrderRef.current,
                            flowNode.data.collectionNode.frontIndex,
                          )
                        : getCanvasTextRestingZIndex(
                            flowNode.data.object.frontIndex,
                          ),
                  }
                : flowNode,
            ),
          );
          const targetFolderNodeId = dropTargetNodeIdRef.current;
          clearDropTarget();

          if (!session || session.primaryNodeId !== node.id) return;

          if (
            targetFolderNodeId &&
            [...session.movingIds].every((id) =>
              PERSISTED_CANVAS_ITEM_ID.test(id),
            )
          ) {
            const nodeIds = [...session.movingIds];
            const nodeIdsKey = nodeIds.join(",");
            suppressClicks(...nodeIds, targetFolderNodeId);
            setPendingFolderDrop({
              nodeIds,
              nodeIdsKey,
              targetFolderNodeId,
            });
            moveNodesToFolder.mutate(
              {
                nodeIds,
                folderPath,
                targetFolderNodeId,
                sourceCollectionSlug: collectionSlug,
                sourceFolderPath: folderPath,
                measurements: dragNodes.flatMap((dragNode) =>
                  dragNode.measured?.width && dragNode.measured?.height
                    ? [
                        {
                          id: dragNode.id,
                          width: dragNode.measured.width,
                          height: dragNode.measured.height,
                          position: roundPosition(
                            session.origins.get(dragNode.id) ??
                              dragNode.position,
                          ),
                        },
                      ]
                    : [],
                ),
                arrowSnapshots: session.arrowSnapshots,
              },
              {
                onError: () => {
                  setPendingFolderDrop((current) =>
                    current?.nodeIdsKey === nodeIdsKey &&
                    current.targetFolderNodeId === targetFolderNodeId
                      ? undefined
                      : current,
                  );
                  setFlowNodes((current) =>
                    nodeIds.reduce((next, nodeId) => {
                      const origin = session.origins.get(nodeId);
                      return origin
                        ? updateLocalNodePosition(next, nodeId, origin)
                        : next;
                    }, current),
                  );
                },
                onSettled: () => {
                  setPendingFolderDrop((current) =>
                    current?.nodeIdsKey === nodeIdsKey &&
                    current.targetFolderNodeId === targetFolderNodeId
                      ? undefined
                      : current,
                  );
                },
              },
            );
            setGroupArrowPreviews(undefined);
            return;
          }

          const moved = dragNodes.flatMap((dragNode) => {
            const origin = session.origins.get(dragNode.id);
            const position = roundPosition(
              session.currentPositions.get(dragNode.id) ?? dragNode.position,
            );
            return origin && !positionsEqual(origin, position)
              ? [{ node: dragNode, origin, position }]
              : [];
          });
          if (moved.length === 0) return;

          const itemIdsBottomToTop = [...dragNodes]
            .reverse()
            .map((dragNode) => dragNode.id);
          const currentFrontIndexes = new Map<string, number>();
          for (const flowNode of getNodes()) {
            const frontIndex =
              flowNode.type === "asset"
                ? flowNode.data.collectionNode.frontIndex
                : flowNode.data.object.frontIndex;
            if (frontIndex != null) {
              currentFrontIndexes.set(flowNode.id, frontIndex);
            }
          }
          const optimisticFrontIndexes = promoteCanvasFrontIndexes(
            currentFrontIndexes,
            itemIdsBottomToTop,
          );
          setFlowNodes((current) =>
            current.map((flowNode) => {
              const frontIndex = optimisticFrontIndexes.get(flowNode.id);
              return frontIndex === undefined
                ? flowNode
                : { ...flowNode, zIndex: getCanvasFrontZIndex(frontIndex) };
            }),
          );

          const persistedItemIds = itemIdsBottomToTop.filter((itemId) => {
            const dragNode = dragNodes.find(
              (candidate) => candidate.id === itemId,
            );
            if (!dragNode || dragNode.id.startsWith("text-draft-")) {
              return false;
            }
            return (
              dragNode.type === "text" ||
              !isPendingCollectionNode(dragNode.data.collectionNode)
            );
          });
          if (persistedItemIds.length > 0) {
            updateCanvasItemFrontIndexesMutation({
              itemIds: persistedItemIds,
              expectedParentFolderNodeId,
              folderPath,
              optimisticItems: [...optimisticFrontIndexes].map(
                ([id, frontIndex]) => ({ id, frontIndex }),
              ),
            });
          }

          setFlowNodes((current) =>
            moved.reduce(
              (next, { node: movedNode, position }) =>
                updateLocalNodePosition(next, movedNode.id, position),
              current,
            ),
          );
          suppressClicks(...moved.map(({ node: movedNode }) => movedNode.id));

          if (session.isGroup) {
            const primaryOrigin = session.origins.get(session.primaryNodeId);
            const primaryPosition = session.currentPositions.get(
              session.primaryNodeId,
            );
            if (!primaryOrigin || !primaryPosition) return;
            saveGroupGeometry(
              session.origins,
              session.movingIds,
              session.arrowSnapshots,
              {
                x: primaryPosition.x - primaryOrigin.x,
                y: primaryPosition.y - primaryOrigin.y,
              },
            );
            return;
          }

          const [single] = moved;
          if (!single) return;
          const { node: movedNode, origin, position } = single;
          if (movedNode.type === "text") {
            if (!movedNode.id.startsWith("text-draft-")) {
              updateCanvasTextMutation(
                { objectId: movedNode.id, position },
                {
                  onError: () =>
                    setFlowNodes((current) =>
                      updateLocalNodePosition(current, movedNode.id, origin),
                    ),
                },
              );
            } else {
              setDraftText((current) =>
                current?.id === movedNode.id
                  ? { ...current, position }
                  : current,
              );
            }
            return;
          }
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
        {editingTextNode ? (
          <ViewportPortal>
            <CanvasTextEditor
              key={editingTextNode.id}
              object={editingTextNode.data.object}
              position={editingTextNode.position}
              onCommit={commitText}
            />
          </ViewportPortal>
        ) : null}
        <CanvasArrowLayer
          arrows={canvasObjects.filter(
            (object): object is CanvasArrowObject => object.type === "arrow",
          )}
          draft={draftArrow}
          selectedIds={selectedIdSet}
          focusedId={focusedCanvasObjectId}
          pointEditId={editingArrowId}
          enabled={activeTool === "select"}
          editable={!isCanvasLocked && activeTool === "select"}
          onSelect={handleArrowSelect}
          onFocus={handleArrowFocus}
          onPointEditChange={setEditingArrowId}
          onUpdate={updateArrowObject}
          onDelete={deleteCanvasObject}
          groupPreviews={groupArrowPreviews}
          onGroupDragStart={beginArrowGroupDrag}
          onGroupDragMove={moveArrowGroupDrag}
          onGroupDragEnd={endArrowGroupDrag}
          onGroupDragCancel={cancelArrowGroupDrag}
        />
        <CanvasAlignmentGuideLines
          guides={alignmentGuides}
          zoom={getViewport().zoom}
        />
        <Panel position="top-center" className="m-3">
          {focusedInspectorTarget ? (
            <CanvasObjectInspector
              boardKey={boardKey}
              target={focusedInspectorTarget}
              modifierLabel={getPlatformModifier()}
              onMove={
                /^(text|arrow)-\d+$/.test(focusedInspectorTarget.object.id)
                  ? () => setMoveDialogOpen(true)
                  : undefined
              }
            />
          ) : (
            <SelectionActionBar
              count={selectedIds.length}
              surface="canvas"
              onClear={() => {
                setCanvasObjectFocus(undefined);
                clearSelection(boardKey);
              }}
              onMove={
                canMoveSelection ? () => setMoveDialogOpen(true) : undefined
              }
              onDelete={handleBulkDelete}
              onArrange={
                layoutableSelectionCount >= 2 ? handleArrange : undefined
              }
              onCompact={
                layoutableSelectionCount >= 2 ? handleCompact : undefined
              }
              onMakeRow={
                layoutableSelectionCount >= 2 ? handleMakeRow : undefined
              }
              onMakeColumn={
                layoutableSelectionCount >= 2 ? handleMakeColumn : undefined
              }
              layoutCount={layoutableSelectionCount}
            />
          )}
        </Panel>
      </ReactFlow>

      {loadError ? (
        <div className="absolute inset-0 z-10">{loadError}</div>
      ) : nodes.length === 0 && canvasObjects.length === 0 && !draftText ? (
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
          className={selectionMarqueeClassName}
          style={{
            left: marquee.marquee.left,
            top: marquee.marquee.top,
            width: marquee.marquee.right - marquee.marquee.left,
            height: marquee.marquee.bottom - marquee.marquee.top,
          }}
        />
      ) : null}
      <MoveToDialog
        open={moveDialogOpen && selectedIds.length > 0 && canMoveSelection}
        onOpenChange={setMoveDialogOpen}
        source={
          moveSource ?? {
            workspaceSlug,
            sourceCollectionSlug: collectionSlug,
            sourceFolderPath: folderPath,
            nodeIds: selectedIds,
          }
        }
        onMoved={() => {
          setCanvasObjectFocus(undefined);
          clearSelection(boardKey);
        }}
      />
    </div>
  );
}

function makeFlowNode(
  collectionNode: CollectionNode,
  index: number,
  data: CanvasNodeData,
  expandedNoteOrder: readonly string[],
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
    // Expanded notes float above resting cards. Drag and drop-stack layers
    // remain above them while an interaction is active.
    zIndex: data.dropStackStyle
      ? getCanvasInteractionZIndex(data.dropStackStyle.stackOrder)
      : current?.dragging
        ? getCanvasInteractionZIndex()
        : getCanvasRestingZIndex(
            collectionNode,
            expandedNoteOrder,
            collectionNode.frontIndex,
          ),
    style: { width: BOARD_CARD_WIDTH },
  };
}

function makeTextFlowNode(
  object: CanvasTextObject,
  data: CanvasTextNodeData,
  current?: CanvasTextFlowNode,
): CanvasTextFlowNode {
  return {
    ...current,
    id: object.id,
    type: "text",
    position: current?.position ?? object.position,
    data,
    draggable: !data.editing,
    selectable: false,
    zIndex: current?.dragging
      ? getCanvasInteractionZIndex()
      : getCanvasTextRestingZIndex(object.frontIndex),
    style: undefined,
  };
}

function getCanvasCardHeight(node: CanvasFlowNode): number {
  const measuredHeight = node.measured?.height;
  if (measuredHeight && Number.isFinite(measuredHeight)) {
    return measuredHeight;
  }

  if (node.type !== "asset") return 80;
  const collectionNode = node.data.collectionNode;
  if (collectionNode.type === "image") {
    return (BOARD_CARD_WIDTH * collectionNode.height) / collectionNode.width;
  }

  return BOARD_CARD_WIDTH;
}

function updateLocalNodePosition(
  nodes: CanvasFlowNode[],
  nodeId: string,
  position: XYPosition,
): CanvasFlowNode[] {
  return nodes.map((node) =>
    node.id === nodeId ? { ...node, position } : node,
  );
}

function toCanvasAlignmentRect(
  node: CanvasFlowNode,
): CanvasAlignmentRect | undefined {
  const width = node.measured?.width;
  const height = node.measured?.height;
  if (
    !width ||
    !height ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    return undefined;
  }

  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  };
}

function getCanvasViewportBounds(
  surface: { width: number; height: number },
  viewport: Viewport,
) {
  return {
    left: -viewport.x / viewport.zoom,
    top: -viewport.y / viewport.zoom,
    right: (surface.width - viewport.x) / viewport.zoom,
    bottom: (surface.height - viewport.y) / viewport.zoom,
  };
}

function getPositionChange(
  changes: NodeChange<CanvasFlowNode>[],
  nodeId: string,
): NodePositionChange | undefined {
  return changes.find(
    (change): change is NodePositionChange =>
      change.type === "position" && change.id === nodeId,
  );
}

function withAlignedDragPositions(
  changes: NodeChange<CanvasFlowNode>[],
  session: CanvasDragSession,
  offset: XYPosition,
  dragging: boolean | undefined,
): NodeChange<CanvasFlowNode>[] {
  const draggedNodeIds = new Set(session.draggedRects.keys());
  const nonDragPositionChanges = changes.filter(
    (change) => change.type !== "position" || !draggedNodeIds.has(change.id),
  );
  const alignedChanges: NodePositionChange[] = Array.from(
    session.draggedRects.values(),
    (rectangle) => {
      const position = {
        x: rectangle.x + offset.x,
        y: rectangle.y + offset.y,
      };
      return {
        id: rectangle.id,
        type: "position",
        position,
        positionAbsolute: position,
        dragging,
      };
    },
  );

  return [...nonDragPositionChanges, ...alignedChanges];
}

function recordDraggedChangePositions(
  session: CanvasDragSession,
  changes: NodeChange<CanvasFlowNode>[],
) {
  for (const change of changes) {
    if (
      change.type === "position" &&
      change.position &&
      session.currentPositions.has(change.id)
    ) {
      session.currentPositions.set(change.id, change.position);
    }
  }
}

function setDraggedPositions(session: CanvasDragSession, offset: XYPosition) {
  for (const rectangle of session.draggedRects.values()) {
    session.currentPositions.set(rectangle.id, {
      x: rectangle.x + offset.x,
      y: rectangle.y + offset.y,
    });
  }
}

function alignmentGuidesEqual(
  left: CanvasAlignmentGuides | undefined,
  right: CanvasAlignmentGuides | undefined,
): boolean {
  return (
    alignmentGuideSegmentEqual(left?.vertical, right?.vertical) &&
    alignmentGuideSegmentEqual(left?.horizontal, right?.horizontal)
  );
}

function alignmentGuideSegmentEqual(
  left: CanvasAlignmentGuides["vertical"],
  right: CanvasAlignmentGuides["vertical"],
): boolean {
  return (
    left?.coordinate === right?.coordinate &&
    left?.start === right?.start &&
    left?.end === right?.end
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
    (node.type === "note" && node.id.startsWith("note-optimistic-")) ||
    (node.type === "link" && node.id.startsWith("link-optimistic-")) ||
    (node.type === "color" && node.id.startsWith("color-optimistic-")) ||
    (node.type === "folder" && node.flattenStatus === "pending")
  );
}

function isDraggableNode(node: CanvasFlowNode): boolean {
  return (
    node.type === "text" || !isPendingCollectionNode(node.data.collectionNode)
  );
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
  if (
    node.type === "image" ||
    node.type === "note" ||
    node.type === "link" ||
    node.type === "color"
  ) {
    return node.clientId;
  }

  return undefined;
}
