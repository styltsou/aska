type QueueEntry<T> = {
  isSaving: boolean;
  hasPendingValue: boolean;
  pendingValue?: T;
};

/**
 * Serializes writes for each key and coalesces changes made while a write is
 * in flight, so only the newest pending value is persisted next.
 */
export function createLatestValueQueue<T>(
  save: (key: string, value: T) => Promise<void>,
) {
  const entries = new Map<string, QueueEntry<T>>();

  const run = (key: string, entry: QueueEntry<T>, value: T) => {
    entry.isSaving = true;

    void save(key, value)
      .catch(() => {
        // The caller owns error handling for an individual write.
      })
      .finally(() => {
        if (entry.hasPendingValue) {
          const pendingValue = entry.pendingValue!;
          entry.hasPendingValue = false;
          entry.pendingValue = undefined;
          run(key, entry, pendingValue);
          return;
        }

        entries.delete(key);
      });
  };

  return {
    enqueue(key: string, value: T) {
      const entry = entries.get(key);
      if (entry?.isSaving) {
        entry.pendingValue = value;
        entry.hasPendingValue = true;
        return;
      }

      const nextEntry: QueueEntry<T> = {
        isSaving: false,
        hasPendingValue: false,
      };
      entries.set(key, nextEntry);
      run(key, nextEntry, value);
    },
  };
}
