export function crumbPathThrough(
  crumbs: readonly { slug: string }[],
  endIndex: number,
): string | undefined {
  if (endIndex < 0) return undefined;
  return crumbs
    .slice(0, endIndex + 1)
    .map((crumb) => crumb.slug)
    .join("/");
}

export function joinPath(parentPath: string | undefined, slug: string): string {
  return parentPath ? `${parentPath}/${slug}` : slug;
}

export function moveSuccessMessage(count: number): string {
  return count === 1 ? "Item moved." : `${count} items moved.`;
}
