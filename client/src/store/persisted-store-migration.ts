export function migratePersistedAppStore(
  state: unknown,
  legacyViews?: unknown,
): Record<string, unknown> {
  const persistedState = isRecord(state) ? state : {};
  const { workspaceBoardActionRails, ...remainingState } = persistedState;

  return {
    ...remainingState,
    boardActionRailVisible:
      typeof persistedState.boardActionRailVisible === "boolean"
        ? persistedState.boardActionRailVisible
        : isRecord(workspaceBoardActionRails) &&
          Object.values(workspaceBoardActionRails).some(
            (value) => value === true,
          ),
    collectionViews: isRecord(persistedState.collectionViews)
      ? persistedState.collectionViews
      : isRecord(legacyViews)
        ? legacyViews
        : {},
  };
}

export function mergePersistedAppStore<T extends object>(
  persistedState: unknown,
  currentState: T,
): T {
  return {
    ...currentState,
    ...migratePersistedAppStore(persistedState),
  } as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
