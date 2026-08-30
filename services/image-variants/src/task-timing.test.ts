import { describe, expect, it } from "vitest";

import {
  TASK_CLAIM_LEASE_MS,
  TASK_DLQ_RECEIVE_LIMIT,
  TASK_MAINTENANCE_REQUEUE_AFTER_MS,
  TASK_MAX_PROCESSING_ATTEMPTS,
  TASK_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
} from "../../image-shared/src/task-timing";

describe("shared worker timing", () => {
  it("lets an SQS retry reclaim work before maintenance dispatches a replacement", () => {
    const visibilityMs = TASK_QUEUE_VISIBILITY_TIMEOUT_SECONDS * 1_000;

    expect(TASK_CLAIM_LEASE_MS).toBeLessThan(visibilityMs);
    expect(visibilityMs).toBeLessThan(TASK_MAINTENANCE_REQUEUE_AFTER_MS);
    expect(TASK_DLQ_RECEIVE_LIMIT).toBe(TASK_MAX_PROCESSING_ATTEMPTS + 1);
  });
});
