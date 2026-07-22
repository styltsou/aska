import type { CollectionNode } from "@/api/collection";
import type {
  BoardInsertionPlacement,
  BoardPosition,
  BoardVisibleBounds,
} from "@/api/collection/types";

export const BOARD_CARD_WIDTH = 280;
export const BOARD_ITEM_GAP = 32;

export type CanvasLayoutNode = CollectionNode & {
  layoutWidth?: number;
  layoutHeight?: number;
};

const FALLBACK_COLUMNS = 5;
const FALLBACK_ROW_HEIGHT = 400;
const FALLBACK_ORIGIN = 48;
const NOTE_CARD_MAX_HEIGHT = 320;
const FOLDER_CARD_HEIGHT = BOARD_CARD_WIDTH;
const COLLISION_SEARCH_STEP = BOARD_ITEM_GAP;
const COLLISION_SEARCH_LIMIT = 64;

export function getInitialNodePosition(
  node: CollectionNode,
  index: number,
): BoardPosition {
  if (node.position) return node.position;

  return getFallbackPosition(index);
}

export function reserveNodePositions(
  existingNodes: CollectionNode[],
  newNodes: CollectionNode[],
  placement?: BoardPosition | BoardInsertionPlacement,
): BoardPosition[] {
  const { position: requested, visibleBounds } = normalizePlacement(placement);
  const occupied = existingNodes.map((node, index) =>
    getNodeBounds(node, getInitialNodePosition(node, index)),
  );
  const preferredPositions = visibleBounds
    ? getVisibleBatchPositions(
        getPlacementNodes(newNodes, placement),
        requested,
        visibleBounds,
      ).slice(
        getBatchStartIndex(placement),
        getBatchStartIndex(placement) + newNodes.length,
      )
    : newNodes.map((_, index) =>
        requested
          ? {
              x: Math.round(
                requested.x + index * (BOARD_CARD_WIDTH + BOARD_ITEM_GAP),
              ),
              y: Math.round(requested.y),
            }
          : getFallbackPosition(existingNodes.length + index),
      );

  return newNodes.map((node, index) => {
    const position = findAvailablePosition(
      node,
      preferredPositions[index]!,
      occupied,
      visibleBounds,
    );

    occupied.push(getNodeBounds(node, position));
    return position;
  });
}

type NodeBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function findAvailablePosition(
  node: CollectionNode,
  preferred: BoardPosition,
  occupied: NodeBounds[],
  visibleBounds?: BoardVisibleBounds,
): BoardPosition {
  if (
    isAvailablePosition(node, preferred, occupied, visibleBounds) &&
    (!visibleBounds || isWithinVisibleBounds(node, preferred, visibleBounds))
  ) {
    return preferred;
  }

  for (let radius = 1; radius <= COLLISION_SEARCH_LIMIT; radius += 1) {
    for (const offset of squarePerimeterOffsets(radius)) {
      const position = {
        x: preferred.x + offset.x * COLLISION_SEARCH_STEP,
        y: preferred.y + offset.y * COLLISION_SEARCH_STEP,
      };

      if (
        isAvailablePosition(node, position, occupied, visibleBounds) &&
        (!visibleBounds || isWithinVisibleBounds(node, position, visibleBounds))
      ) {
        return position;
      }
    }
  }

  if (isAvailablePosition(node, preferred, occupied)) {
    return preferred;
  }

  for (let radius = 1; radius <= COLLISION_SEARCH_LIMIT; radius += 1) {
    for (const offset of squarePerimeterOffsets(radius)) {
      const position = {
        x: preferred.x + offset.x * COLLISION_SEARCH_STEP,
        y: preferred.y + offset.y * COLLISION_SEARCH_STEP,
      };

      if (isAvailablePosition(node, position, occupied)) {
        return position;
      }
    }
  }

  return {
    x: preferred.x + (COLLISION_SEARCH_LIMIT + 1) * COLLISION_SEARCH_STEP,
    y: preferred.y,
  };
}

function* squarePerimeterOffsets(radius: number) {
  for (let y = -radius; y <= radius; y += 1) {
    yield { x: -radius, y };
    yield { x: radius, y };
  }

  for (let x = -radius + 1; x < radius; x += 1) {
    yield { x, y: -radius };
    yield { x, y: radius };
  }
}

function getNodeBounds(
  node: CanvasLayoutNode,
  position: BoardPosition,
): NodeBounds {
  const height = getNodeHeight(node);
  const inset = BOARD_ITEM_GAP / 2;

  return {
    left: position.x - inset,
    top: position.y - inset,
    right: position.x + BOARD_CARD_WIDTH + inset,
    bottom: position.y + height + inset,
  };
}

function getNodeHeight(node: CanvasLayoutNode): number {
  if (node.layoutHeight && node.layoutHeight > 0) return node.layoutHeight;

  if (node.type === "image" && node.width > 0 && node.height > 0) {
    return BOARD_CARD_WIDTH * (node.height / node.width);
  }

  return node.type === "note" ? NOTE_CARD_MAX_HEIGHT : FOLDER_CARD_HEIGHT;
}

function normalizePlacement(
  placement: BoardPosition | BoardInsertionPlacement | undefined,
): BoardInsertionPlacement {
  if (!placement) return {};

  if ("x" in placement && "y" in placement) {
    return { position: placement };
  }

  return placement;
}

function getPlacementNodes(
  newNodes: CollectionNode[],
  placement: BoardPosition | BoardInsertionPlacement | undefined,
): CollectionNode[] {
  if (
    !placement ||
    "x" in placement ||
    !placement.batch ||
    newNodes.length !== 1
  ) {
    return newNodes;
  }

  return Array.from({ length: placement.batch.size }, () => newNodes[0]!);
}

function getBatchStartIndex(
  placement: BoardPosition | BoardInsertionPlacement | undefined,
): number {
  if (!placement || "x" in placement || !placement.batch) return 0;

  return placement.batch.index;
}

function getVisibleBatchPositions(
  nodes: CollectionNode[],
  requested: BoardPosition | undefined,
  visibleBounds: BoardVisibleBounds,
): BoardPosition[] {
  if (nodes.length === 0) return [];

  const maxColumns = Math.max(
    1,
    Math.floor(
      (visibleBounds.right - visibleBounds.left + BOARD_ITEM_GAP) /
        (BOARD_CARD_WIDTH + BOARD_ITEM_GAP),
    ),
  );
  const firstPosition = requested
    ? clampToVisibleBounds(nodes[0]!, requested, visibleBounds)
    : undefined;
  const columns = Math.min(
    nodes.length,
    firstPosition
      ? Math.max(
          1,
          Math.floor(
            (visibleBounds.right - firstPosition.x + BOARD_ITEM_GAP) /
              (BOARD_CARD_WIDTH + BOARD_ITEM_GAP),
          ),
        )
      : maxColumns,
  );
  const rowHeights = getRowHeights(nodes, columns);
  const contentWidth =
    columns * BOARD_CARD_WIDTH + (columns - 1) * BOARD_ITEM_GAP;
  const contentHeight =
    rowHeights.reduce((total, height) => total + height, 0) +
    (rowHeights.length - 1) * BOARD_ITEM_GAP;
  const start = firstPosition ?? {
    x: clamp(
      (visibleBounds.left + visibleBounds.right - contentWidth) / 2,
      visibleBounds.left,
      visibleBounds.right - contentWidth,
    ),
    y:
      contentHeight <= visibleBounds.bottom - visibleBounds.top
        ? clamp(
            (visibleBounds.top + visibleBounds.bottom - contentHeight) / 2,
            visibleBounds.top,
            visibleBounds.bottom - contentHeight,
          )
        : visibleBounds.top,
  };
  const positions: BoardPosition[] = [];
  let rowTop = start.y;

  for (let index = 0; index < nodes.length; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;

    if (column === 0 && index > 0) {
      rowTop += rowHeights[row - 1]! + BOARD_ITEM_GAP;
    }

    positions.push({
      x: Math.round(start.x + column * (BOARD_CARD_WIDTH + BOARD_ITEM_GAP)),
      y: Math.round(rowTop),
    });
  }

  return positions;
}

function getRowHeights(nodes: CollectionNode[], columns: number): number[] {
  const heights: number[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const row = Math.floor(index / columns);
    heights[row] = Math.max(heights[row] ?? 0, getNodeHeight(nodes[index]!));
  }

  return heights;
}

function clampToVisibleBounds(
  node: CollectionNode,
  position: BoardPosition,
  visibleBounds: BoardVisibleBounds,
): BoardPosition {
  const width = BOARD_CARD_WIDTH;
  const height = getNodeHeight(node);

  return {
    x: Math.round(
      clamp(position.x, visibleBounds.left, visibleBounds.right - width),
    ),
    y: Math.round(
      clamp(position.y, visibleBounds.top, visibleBounds.bottom - height),
    ),
  };
}

function isAvailablePosition(
  node: CollectionNode,
  position: BoardPosition,
  occupied: NodeBounds[],
  visibleBounds?: BoardVisibleBounds,
): boolean {
  if (visibleBounds && !isWithinVisibleBounds(node, position, visibleBounds)) {
    return false;
  }

  return !hasCollision(getNodeBounds(node, position), occupied);
}

function isWithinVisibleBounds(
  node: CollectionNode,
  position: BoardPosition,
  visibleBounds: BoardVisibleBounds,
): boolean {
  return (
    position.x >= visibleBounds.left &&
    position.y >= visibleBounds.top &&
    position.x + BOARD_CARD_WIDTH <= visibleBounds.right &&
    position.y + getNodeHeight(node) <= visibleBounds.bottom
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function hasCollision(candidate: NodeBounds, occupied: NodeBounds[]): boolean {
  return occupied.some(
    (node) =>
      candidate.left < node.right &&
      candidate.right > node.left &&
      candidate.top < node.bottom &&
      candidate.bottom > node.top,
  );
}

function getFallbackPosition(index: number): BoardPosition {
  return {
    x:
      FALLBACK_ORIGIN +
      (index % FALLBACK_COLUMNS) * (BOARD_CARD_WIDTH + BOARD_ITEM_GAP),
    y:
      FALLBACK_ORIGIN +
      Math.floor(index / FALLBACK_COLUMNS) * FALLBACK_ROW_HEIGHT,
  };
}

export function arrangeNodesInGrid(
  selectedNodes: CanvasLayoutNode[],
): BoardPosition[] {
  if (selectedNodes.length === 0) return [];
  if (selectedNodes.length === 1)
    return [selectedNodes[0]!.position ?? { x: 0, y: 0 }];

  const count = selectedNodes.length;
  const positionedNodes = selectedNodes.map((node, originalIndex) => ({
    node,
    originalIndex,
    position: node.position ?? { x: 0, y: 0 },
  }));
  const bounds = getSelectionBounds(positionedNodes);
  const ordered = getReadingOrder(positionedNodes);
  const result: BoardPosition[] = Array.from({ length: count }, () => ({
    x: 0,
    y: 0,
  }));
  const columns = getAspectRatioColumnCount(count, bounds);
  const rows = Math.ceil(count / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const { node } = ordered[index]!;
    columnWidths[column] = Math.max(columnWidths[column]!, getNodeWidth(node));
    rowHeights[row] = Math.max(rowHeights[row]!, getNodeHeight(node));
  }

  const columnLefts = getTrackOffsets(columnWidths);
  const rowTops = getTrackOffsets(rowHeights);

  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const { originalIndex } = ordered[index]!;
    result[originalIndex] = {
      x: Math.round(bounds.left + columnLefts[column]!),
      y: Math.round(bounds.top + rowTops[row]!),
    };
  }

  return result;
}

export function compactNodesInMasonry(
  selectedNodes: CanvasLayoutNode[],
): BoardPosition[] {
  if (selectedNodes.length === 0) return [];
  if (selectedNodes.length === 1)
    return [selectedNodes[0]!.position ?? { x: 0, y: 0 }];

  const count = selectedNodes.length;
  const positionedNodes = selectedNodes.map((node, originalIndex) => ({
    node,
    originalIndex,
    position: node.position ?? { x: 0, y: 0 },
  }));
  const bounds = getSelectionBounds(positionedNodes);
  const ordered = getReadingOrder(positionedNodes);
  let best = getMasonryLayout(ordered, count, bounds, 1);

  for (let columns = 2; columns <= count; columns += 1) {
    const candidate = getMasonryLayout(ordered, count, bounds, columns);
    if (isBetterCompactLayout(candidate, best)) best = candidate;
  }

  return best.positions;
}

export function makeNodesInRow(
  selectedNodes: CanvasLayoutNode[],
): BoardPosition[] {
  if (selectedNodes.length === 0) return [];

  const positionedNodes = selectedNodes.map((node, originalIndex) => ({
    node,
    originalIndex,
    position: node.position ?? { x: 0, y: 0 },
  }));
  const bounds = getSelectionBounds(positionedNodes);
  const result: BoardPosition[] = Array.from(
    { length: selectedNodes.length },
    () => ({ x: 0, y: 0 }),
  );
  let left = bounds.left;

  for (const { node, originalIndex } of getReadingOrder(positionedNodes)) {
    result[originalIndex] = { x: Math.round(left), y: Math.round(bounds.top) };
    left += getNodeWidth(node) + BOARD_ITEM_GAP;
  }

  return result;
}

export function makeNodesInColumn(
  selectedNodes: CanvasLayoutNode[],
): BoardPosition[] {
  if (selectedNodes.length === 0) return [];

  const positionedNodes = selectedNodes.map((node, originalIndex) => ({
    node,
    originalIndex,
    position: node.position ?? { x: 0, y: 0 },
  }));
  const bounds = getSelectionBounds(positionedNodes);
  const result: BoardPosition[] = Array.from(
    { length: selectedNodes.length },
    () => ({ x: 0, y: 0 }),
  );
  let top = bounds.top;

  for (const { node, originalIndex } of getReadingOrder(positionedNodes)) {
    result[originalIndex] = { x: Math.round(bounds.left), y: Math.round(top) };
    top += getNodeHeight(node) + BOARD_ITEM_GAP;
  }

  return result;
}

type PositionedNode = {
  node: CanvasLayoutNode;
  originalIndex: number;
  position: BoardPosition;
};

type MasonryLayout = {
  positions: BoardPosition[];
  width: number;
  height: number;
  columns: number;
};

function getSelectionBounds(nodes: PositionedNode[]): NodeBounds {
  return nodes.reduce<NodeBounds>(
    (bounds, { node, position }) => ({
      left: Math.min(bounds.left, position.x),
      top: Math.min(bounds.top, position.y),
      right: Math.max(bounds.right, position.x + getNodeWidth(node)),
      bottom: Math.max(bounds.bottom, position.y + getNodeHeight(node)),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
}

function getReadingOrder(nodes: PositionedNode[]): PositionedNode[] {
  const byVerticalPosition = [...nodes].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );
  const averageHeight =
    byVerticalPosition.reduce(
      (total, { node }) => total + getNodeHeight(node),
      0,
    ) / byVerticalPosition.length;
  const rowTolerance = averageHeight / 2;
  const rows: PositionedNode[][] = [];

  for (const positionedNode of byVerticalPosition) {
    const row = rows.at(-1);
    if (!row || positionedNode.position.y - row[0]!.position.y > rowTolerance) {
      rows.push([positionedNode]);
    } else {
      row.push(positionedNode);
    }
  }

  return rows.flatMap((row) =>
    row.sort(
      (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
    ),
  );
}

function getAspectRatioColumnCount(count: number, bounds: NodeBounds): number {
  const width = Math.max(bounds.right - bounds.left, BOARD_CARD_WIDTH);
  const height = Math.max(bounds.bottom - bounds.top, 1);
  return Math.min(
    count,
    Math.max(1, Math.round(Math.sqrt(count * (width / height)))),
  );
}

function getMasonryLayout(
  ordered: PositionedNode[],
  count: number,
  bounds: NodeBounds,
  columns: number,
): MasonryLayout {
  const columnWidth = Math.max(
    ...ordered.map(({ node }) => getNodeWidth(node)),
  );
  const columnBottoms = Array.from({ length: columns }, () => bounds.top);
  const positions: BoardPosition[] = Array.from({ length: count }, () => ({
    x: 0,
    y: 0,
  }));

  for (const { node, originalIndex } of ordered) {
    const column = getClosestPosition(
      Math.min(...columnBottoms),
      columnBottoms,
    );
    positions[originalIndex] = {
      x: Math.round(bounds.left + column * (columnWidth + BOARD_ITEM_GAP)),
      y: Math.round(columnBottoms[column]!),
    };
    columnBottoms[column] += getNodeHeight(node) + BOARD_ITEM_GAP;
  }

  return {
    positions,
    width: columns * columnWidth + (columns - 1) * BOARD_ITEM_GAP,
    height: Math.max(
      1,
      Math.max(...columnBottoms) - bounds.top - BOARD_ITEM_GAP,
    ),
    columns,
  };
}

function isBetterCompactLayout(
  candidate: MasonryLayout,
  current: MasonryLayout,
): boolean {
  const candidateScore = getCompactScore(candidate);
  const currentScore = getCompactScore(current);
  if (candidateScore !== currentScore) return candidateScore < currentScore;

  const candidateArea = candidate.width * candidate.height;
  const currentArea = current.width * current.height;
  if (candidateArea !== currentArea) return candidateArea < currentArea;

  return candidate.columns < current.columns;
}

function getCompactScore({ width, height }: MasonryLayout): number {
  return width * height * (1 + Math.abs(Math.log(width / height)));
}

function getAxisPositions(
  nodes: PositionedNode[],
  positions: number,
  getPosition: (node: PositionedNode) => number,
): number[] {
  const sorted = [...nodes].sort((a, b) => getPosition(a) - getPosition(b));
  let targets = Array.from({ length: positions }, (_, position) => {
    const quantileIndex = Math.min(
      sorted.length - 1,
      Math.round((position * (sorted.length - 1)) / (positions - 1 || 1)),
    );
    return getPosition(sorted[quantileIndex]!);
  });

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const totals = Array.from({ length: positions }, () => 0);
    const counts = Array.from({ length: positions }, () => 0);

    for (const node of nodes) {
      const position = getClosestPosition(getPosition(node), targets);
      totals[position] += getPosition(node);
      counts[position] += 1;
    }

    targets = targets.map((target, position) =>
      counts[position]! > 0 ? totals[position]! / counts[position]! : target,
    );
  }

  return targets;
}

function getClosestPosition(position: number, positions: number[]): number {
  let closest = 0;

  for (let index = 1; index < positions.length; index += 1) {
    if (
      Math.abs(position - positions[index]!) <
      Math.abs(position - positions[closest]!)
    ) {
      closest = index;
    }
  }

  return closest;
}

function getTrackOffsets(trackSizes: number[]): number[] {
  const offsets: number[] = [];
  let offset = 0;

  for (const size of trackSizes) {
    offsets.push(offset);
    offset += size + BOARD_ITEM_GAP;
  }

  return offsets;
}

function getNodeWidth(node: CanvasLayoutNode): number {
  return node.layoutWidth && node.layoutWidth > 0
    ? node.layoutWidth
    : BOARD_CARD_WIDTH;
}
