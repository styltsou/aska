export const first = <T>(items: readonly T[]): T | null => items[0] ?? null;

export const firstOrThrow = <T>(
  items: readonly T[],
  createError: () => Error,
): T => {
  const item = first(items);
  if (!item) {
    throw createError();
  }
  return item;
};
