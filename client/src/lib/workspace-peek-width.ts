const HARD_MIN_WIDTH = 320;

export function getWorkspacePeekWidthBounds(viewportWidth: number) {
  const max = Math.round(viewportWidth * 0.5);
  const min = Math.min(
    max,
    Math.max(HARD_MIN_WIDTH, Math.round(viewportWidth * 0.28)),
  );
  const defaultWidth = Math.min(
    max,
    Math.max(min, Math.min(640, Math.round(viewportWidth * 0.36))),
  );
  return { min, max, defaultWidth };
}
