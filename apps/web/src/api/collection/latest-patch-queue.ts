type Deferred<TResult> = {
  resolve: (result: TResult) => void;
  reject: (error: unknown) => void;
};

type PatchBatch<TPatch, TResult> = {
  patch: TPatch;
  deferred: Deferred<TResult>[];
};

type QueueEntry<TPatch, TResult> = {
  active: PatchBatch<TPatch, TResult>;
  pending?: PatchBatch<TPatch, TResult>;
};

type LatestPatchQueueOptions<TPatch, TResult> = {
  save: (key: string, patch: TPatch) => Promise<TResult>;
  merge: (current: TPatch, next: TPatch) => TPatch;
  onSuccess?: (key: string, result: TResult, hasPending: boolean) => void;
  onError?: (key: string, error: unknown, hasPending: boolean) => void;
};

/**
 * Serializes writes per key while folding all waiting patches into the next
 * write. Every caller observes the result of the batch containing its patch.
 */
export function createLatestPatchQueue<TPatch, TResult>({
  save,
  merge,
  onSuccess,
  onError,
}: LatestPatchQueueOptions<TPatch, TResult>) {
  const entries = new Map<string, QueueEntry<TPatch, TResult>>();

  const run = async (key: string, entry: QueueEntry<TPatch, TResult>) => {
    const batch = entry.active;

    try {
      const result = await save(key, batch.patch);
      onSuccess?.(key, result, entry.pending !== undefined);
      batch.deferred.forEach(({ resolve }) => resolve(result));
    } catch (error) {
      onError?.(key, error, entry.pending !== undefined);
      batch.deferred.forEach(({ reject }) => reject(error));
    } finally {
      const pending = entry.pending;
      if (pending) {
        entry.active = pending;
        entry.pending = undefined;
        void run(key, entry);
      } else {
        entries.delete(key);
      }
    }
  };

  return {
    enqueue(key: string, patch: TPatch): Promise<TResult> {
      let resolve!: (result: TResult) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<TResult>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
      });
      const deferred = { resolve, reject };
      const entry = entries.get(key);

      if (!entry) {
        const nextEntry: QueueEntry<TPatch, TResult> = {
          active: { patch, deferred: [deferred] },
        };
        entries.set(key, nextEntry);
        void run(key, nextEntry);
        return promise;
      }

      if (entry.pending) {
        entry.pending.patch = merge(entry.pending.patch, patch);
        entry.pending.deferred.push(deferred);
      } else {
        entry.pending = { patch, deferred: [deferred] };
      }

      return promise;
    },
  };
}
