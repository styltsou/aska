export const CANVAS_CARD_WIDTH = 280;
export const CANVAS_ITEM_GAP = 32;

const NOTE_CARD_MAX_HEIGHT = 320;
const LOCAL_NUDGE_LIMIT = 4;
const COMPOSITION_SEARCH_LIMIT = 16;
const EMPTY_FOLDER_POSITION = { x: 48, y: 48 };

export type MovePlacementNode = {
  nodeType: "asset" | "folder";
  assetType: "image" | "note" | null;
  imageWidth: number | null;
  imageHeight: number | null;
  positionX: number | null;
  positionY: number | null;
};

type BoardPosition = { x: number; y: number };
type CardFootprint = { width: number; height: number };
type Bounds = { left: number; top: number; right: number; bottom: number };

/**
 * Finds a system-chosen destination position for a node moved into a folder.
 * A single move preserves the composition centre and makes only a bounded,
 * deterministic local nudge. Batch moves deliberately use the denser packing
 * search described by the placement policy.
 */
export function getFolderMovePosition(
  destinationNodes: MovePlacementNode[],
  movedNode: MovePlacementNode,
  isBatch = false,
): BoardPosition {
  const positionedNodes = destinationNodes.flatMap((node) => {
    if (node.positionX === null || node.positionY === null) return [];

    return [
      {
        position: { x: node.positionX, y: node.positionY },
        footprint: getCardFootprint(node),
      },
    ];
  });
  if (positionedNodes.length === 0) return EMPTY_FOLDER_POSITION;

  const footprint = getCardFootprint(movedNode);
  const compositionBounds = getCompositionBounds(positionedNodes);
  const preferred = {
    x: Math.round(
      (compositionBounds.left + compositionBounds.right - footprint.width) / 2,
    ),
    y: Math.round(
      (compositionBounds.top + compositionBounds.bottom - footprint.height) / 2,
    ),
  };

  if (!isBatch) {
    return findLocalNudgePosition(
      preferred,
      footprint,
      positionedNodes,
      compositionBounds,
    );
  }

  for (let radius = 0; radius <= COMPOSITION_SEARCH_LIMIT; radius += 1) {
    for (const offset of squarePerimeterOffsets(radius)) {
      const position = {
        x: preferred.x + offset.x * (footprint.width + CANVAS_ITEM_GAP),
        y: preferred.y + offset.y * (footprint.height + CANVAS_ITEM_GAP),
      };

      if (
        isAvailable(position, footprint, positionedNodes, compositionBounds)
      ) {
        return position;
      }
    }
  }

  // A full composition still has a clear visual centre. Keep the move near
  // its destination rather than inventing a distant fallback location.
  return preferred;
}

function findLocalNudgePosition(
  preferred: BoardPosition,
  footprint: CardFootprint,
  occupiedNodes: Array<{ position: BoardPosition; footprint: CardFootprint }>,
  compositionBounds: Bounds,
): BoardPosition {
  for (let step = 0; step <= LOCAL_NUDGE_LIMIT; step += 1) {
    const position = {
      x: preferred.x + step * (footprint.width + CANVAS_ITEM_GAP),
      y: preferred.y,
    };
    if (isAvailable(position, footprint, occupiedNodes, compositionBounds)) {
      return position;
    }
  }

  return preferred;
}

/**
 * Finds the anchor for a flattened folder's direct-child composition.
 * The group is placed immediately to the right of the existing parent canvas;
 * callers translate every child by the same delta to preserve its composition.
 */
export function getFlattenGroupAnchor(
  existingNodes: MovePlacementNode[],
): BoardPosition {
  const positionedNodes = existingNodes.flatMap((node) => {
    if (node.positionX === null || node.positionY === null) return [];

    return [
      {
        position: { x: node.positionX, y: node.positionY },
        footprint: getCardFootprint(node),
      },
    ];
  });

  if (positionedNodes.length === 0) return EMPTY_FOLDER_POSITION;

  const bounds = getCompositionBounds(positionedNodes);
  return { x: bounds.right + CANVAS_ITEM_GAP, y: bounds.top };
}

function getCardFootprint(node: MovePlacementNode): CardFootprint {
  if (
    node.nodeType === "asset" &&
    node.assetType === "image" &&
    node.imageWidth &&
    node.imageHeight
  ) {
    return {
      width: CANVAS_CARD_WIDTH,
      height: CANVAS_CARD_WIDTH * (node.imageHeight / node.imageWidth),
    };
  }

  return {
    width: CANVAS_CARD_WIDTH,
    height:
      node.nodeType === "asset" && node.assetType === "note"
        ? NOTE_CARD_MAX_HEIGHT
        : CANVAS_CARD_WIDTH,
  };
}

function getCompositionBounds(
  nodes: Array<{ position: BoardPosition; footprint: CardFootprint }>,
): Bounds {
  return nodes.reduce<Bounds>(
    (bounds, node) => ({
      left: Math.min(bounds.left, node.position.x),
      top: Math.min(bounds.top, node.position.y),
      right: Math.max(bounds.right, node.position.x + node.footprint.width),
      bottom: Math.max(bounds.bottom, node.position.y + node.footprint.height),
    }),
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
  );
}

function isAvailable(
  position: BoardPosition,
  footprint: CardFootprint,
  occupiedNodes: Array<{ position: BoardPosition; footprint: CardFootprint }>,
  compositionBounds: Bounds,
): boolean {
  return (
    isWithinBounds(position, footprint, compositionBounds) &&
    !occupiedNodes.some((node) =>
      intersects(
        getCollisionBounds(position, footprint),
        getCollisionBounds(node.position, node.footprint),
      ),
    )
  );
}

function isWithinBounds(
  position: BoardPosition,
  footprint: CardFootprint,
  bounds: Bounds,
): boolean {
  return (
    position.x >= bounds.left &&
    position.y >= bounds.top &&
    position.x + footprint.width <= bounds.right &&
    position.y + footprint.height <= bounds.bottom
  );
}

function getCollisionBounds(
  position: BoardPosition,
  footprint: CardFootprint,
): Bounds {
  const inset = CANVAS_ITEM_GAP / 2;
  return {
    left: position.x - inset,
    top: position.y - inset,
    right: position.x + footprint.width + inset,
    bottom: position.y + footprint.height + inset,
  };
}

function intersects(left: Bounds, right: Bounds): boolean {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

function* squarePerimeterOffsets(radius: number) {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (Math.max(Math.abs(x), Math.abs(y)) === radius) yield { x, y };
    }
  }
}
