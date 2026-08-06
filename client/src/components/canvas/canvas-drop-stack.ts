export type CanvasDropStackPoint = {
  x: number;
  y: number;
  /** Measured card height, used to keep scaled cards' visible tops aligned. */
  height?: number;
};

export type CanvasDropStackStyle = {
  translateX: number;
  translateY: number;
  rotation: number;
  scale: number;
  stackOrder: number;
  delayMs: number;
};

const DROP_STACK_SCALE = 0.72;

export function makeCanvasDropStackStyles(
  primaryNodeId: string,
  origins: ReadonlyMap<string, CanvasDropStackPoint>,
): Map<string, CanvasDropStackStyle> {
  if (origins.size === 0) return new Map();

  const primaryOrigin = origins.get(primaryNodeId);
  if (!primaryOrigin) return new Map();

  const styles = new Map<string, CanvasDropStackStyle>();
  const trailingNodeIds = [...origins.keys()].filter(
    (nodeId) => nodeId !== primaryNodeId,
  );
  styles.set(primaryNodeId, {
    translateX: 0,
    translateY: 0,
    rotation: 0,
    scale: DROP_STACK_SCALE,
    stackOrder: origins.size + 1,
    delayMs: 0,
  });

  trailingNodeIds.forEach((nodeId, index) => {
    const origin = origins.get(nodeId);
    if (!origin) return;

    const depth = index + 1;
    const depthProgress = depth / trailingNodeIds.length;
    const direction = index % 2 === 0 ? -1 : 1;
    const fanX = direction * (7 + depthProgress * 16);
    const fanY = 10 + depthProgress * 72;
    const scaleHeightCompensation =
      ((primaryOrigin.height ?? 0) - (origin.height ?? 0)) *
      (1 - DROP_STACK_SCALE);

    styles.set(nodeId, {
      translateX: primaryOrigin.x - origin.x + fanX,
      // Cards scale from bottom center. Without this compensation, taller
      // portrait cards' top edges settle lower than landscape cards in the fan.
      translateY: primaryOrigin.y - origin.y + fanY + scaleHeightCompensation,
      rotation: direction * (2 + depthProgress * 3),
      scale: DROP_STACK_SCALE,
      stackOrder: origins.size - index,
      delayMs: Math.min(index * 8, 32),
    });
  });

  return styles;
}
