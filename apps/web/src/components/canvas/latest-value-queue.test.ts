import { describe, expect, it, vi } from "vitest";
import { createLatestValueQueue } from "./latest-value-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("createLatestValueQueue", () => {
  it("serializes writes for a key and keeps only the latest pending value", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const save = vi
      .fn<(key: string, value: number) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const queue = createLatestValueQueue(save);

    queue.enqueue("node-1", 100);
    queue.enqueue("node-1", 200);
    queue.enqueue("node-1", 300);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith("node-1", 100);

    first.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("node-1", 300);

    second.resolve();
  });

  it("allows writes for different keys to proceed independently", () => {
    const first = deferred<void>();
    const second = deferred<void>();
    const save = vi
      .fn<(key: string, value: number) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const queue = createLatestValueQueue(save);

    queue.enqueue("node-1", 100);
    queue.enqueue("node-2", 200);

    expect(save).toHaveBeenCalledWith("node-1", 100);
    expect(save).toHaveBeenCalledWith("node-2", 200);

    first.resolve();
    second.resolve();
  });
});
