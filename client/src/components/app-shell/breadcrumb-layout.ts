// Leave some air around the path, especially beside controls in narrow headers.
export function getBreadcrumbLayout(widths: number[], containerWidth: number) {
  const narrow = containerWidth < 480;
  const available = Math.max(0, containerWidth - (narrow ? 40 : 24));
  const maxCrumbs = narrow ? 3 : 5;
  const count = widths.length;
  const separator = 26; // Separator plus the two list gaps.
  const fullWidth =
    widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, count - 1) * separator;
  let showRoot = true;
  let tailCount = Math.min(count - 1, maxCrumbs - 1);
  if (count <= maxCrumbs && fullWidth <= available) {
    tailCount = count - 1;
  } else {
    while (tailCount > 1) {
      const tailWidth = widths
        .slice(-tailCount)
        .reduce((sum, width) => sum + width, 0);
      if (widths[0] + 24 + tailWidth + (tailCount + 1) * separator <= available)
        break;
      tailCount--;
    }
    if (widths[0] + 24 + (widths.at(-1) ?? 0) + 2 * separator > available)
      showRoot = false;
  }
  return { showRoot, tailCount };
}
