/** Shared queue timings. Keep the claim lease below SQS visibility. */
export const TASK_CLAIM_LEASE_MS = 150 * 1_000;
export const TASK_QUEUE_VISIBILITY_TIMEOUT_SECONDS = 180;
export const TASK_MAINTENANCE_REQUEUE_AFTER_MS = 5 * 60 * 1_000;
export const TASK_MAX_PROCESSING_ATTEMPTS = 5;
export const TASK_DLQ_RECEIVE_LIMIT = TASK_MAX_PROCESSING_ATTEMPTS + 1;
