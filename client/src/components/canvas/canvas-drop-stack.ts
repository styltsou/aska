export type CanvasDropStackPoint = {
  x: number;
  y: number;
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

    styles.set(nodeId, {
      translateX: primaryOrigin.x - origin.x + fanX,
      translateY: primaryOrigin.y - origin.y + fanY,
      rotation: direction * (2 + depthProgress * 3),
      scale: DROP_STACK_SCALE,
      stackOrder: origins.size - index,
      delayMs: Math.min(index * 8, 32),
    });
  });

  return styles;
}
