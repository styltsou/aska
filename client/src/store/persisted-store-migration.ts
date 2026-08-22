export function migratePersistedAppStore(
  state: unknown,
): Record<string, unknown> {
  const persistedState = isRecord(state) ? state : {};

  return {
    ...persistedState,
    workspaceBoardActionRails: isRecord(
      persistedState.workspaceBoardActionRails,
    )
      ? persistedState.workspaceBoardActionRails
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
