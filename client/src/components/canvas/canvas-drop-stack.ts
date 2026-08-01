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

export function makeCanvasDropStackStyles(
  primaryNodeId: string,
  origins: ReadonlyMap<string, CanvasDropStackPoint>,
): Map<string, CanvasDropStackStyle> {
  if (origins.size < 2) return new Map();

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
    scale: 1,
    stackOrder: origins.size + 1,
    delayMs: 0,
  });

  trailingNodeIds.forEach((nodeId, index) => {
    const origin = origins.get(nodeId);
    if (!origin) return;

    const depth = index + 1;
    const direction = index % 2 === 0 ? -1 : 1;
    const fanLevel = Math.floor(index / 2) + 1;
    const fanX = direction * Math.min(3 + fanLevel * 2, 9);
    const fanY = Math.min(depth * 3, 12);

    styles.set(nodeId, {
      translateX: primaryOrigin.x - origin.x + fanX,
      translateY: primaryOrigin.y - origin.y + fanY,
      rotation: direction * Math.min(2 + fanLevel * 0.75, 4),
      scale: 1 - Math.min(depth, 5) * 0.006,
      stackOrder: origins.size - index,
      delayMs: Math.min(index * 8, 32),
    });
  });

  return styles;
}
