const persistedCanvasItemIdPattern =
  /^(folder|image|video|note|link|color|text|arrow)-\d+$/;
const persistedCollectionNodeIdPattern =
  /^(folder|image|video|note|link|color)-\d+$/;

export function isPersistedCanvasItemId(id: string): boolean {
  return persistedCanvasItemIdPattern.test(id);
}

export function isPersistedCollectionNodeId(id: string): boolean {
  return persistedCollectionNodeIdPattern.test(id);
}
