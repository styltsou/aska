import { and, asc, eq, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { mediaCleanupJobs } from "@/db/schema";
import type { IObjectStorageService } from "@/services/object-storage.service";

const DEFAULT_BATCH_SIZE = 50;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
const STALE_CLAIM_AFTER_MS = 10 * 60 * 1000;

export interface IMediaCleanupService {
  processDueJobs(
    batchSize?: number,
  ): Promise<{ deleted: number; failed: number }>;
}

/** Deletes displaced media after the database has made a replacement current. */
export class MediaCleanupService implements IMediaCleanupService {
  constructor(private readonly objectStorageService: IObjectStorageService) {}

  async processDueJobs(batchSize = DEFAULT_BATCH_SIZE) {
    const now = new Date();
    const due = await db
      .select({
        id: mediaCleanupJobs.id,
        objectKeys: mediaCleanupJobs.objectKeys,
        attempts: mediaCleanupJobs.attempts,
      })
      .from(mediaCleanupJobs)
      .where(
        and(
          lte(mediaCleanupJobs.nextAttemptAt, now),
          or(
            eq(mediaCleanupJobs.status, "pending"),
            and(
              eq(mediaCleanupJobs.status, "processing"),
              lte(
                mediaCleanupJobs.processingStartedAt,
                new Date(now.getTime() - STALE_CLAIM_AFTER_MS),
              ),
            ),
          ),
        ),
      )
      .orderBy(asc(mediaCleanupJobs.nextAttemptAt), asc(mediaCleanupJobs.id))
      .limit(batchSize);

    let deleted = 0;
    let failed = 0;
    for (const job of due) {
      // Claim first. A duplicate cron invocation can safely race: S3 deletes
      // are idempotent, and only one of the subsequent DB writes can win.
      const [claimed] = await db
        .update(mediaCleanupJobs)
        .set({ status: "processing", processingStartedAt: new Date() })
        .where(
          and(
            eq(mediaCleanupJobs.id, job.id),
            or(
              eq(mediaCleanupJobs.status, "pending"),
              and(
                eq(mediaCleanupJobs.status, "processing"),
                lte(
                  mediaCleanupJobs.processingStartedAt,
                  new Date(Date.now() - STALE_CLAIM_AFTER_MS),
                ),
              ),
            ),
          ),
        )
        .returning({ id: mediaCleanupJobs.id });
      if (!claimed) continue;

      try {
        await this.objectStorageService.deleteObjects(job.objectKeys);
        await db
          .delete(mediaCleanupJobs)
          .where(eq(mediaCleanupJobs.id, job.id));
        deleted += 1;
      } catch (error) {
        const attempts = job.attempts + 1;
        await db
          .update(mediaCleanupJobs)
          .set({
            status: "pending",
            attempts,
            nextAttemptAt: new Date(Date.now() + retryDelayMs(attempts)),
            processingStartedAt: null,
            lastError:
              error instanceof Error
                ? error.message.slice(0, 1000)
                : "Object cleanup failed",
          })
          .where(eq(mediaCleanupJobs.id, job.id));
        failed += 1;
      }
    }
    return { deleted, failed };
  }
}

function retryDelayMs(attempts: number) {
  return Math.min(60_000 * 2 ** Math.min(attempts - 1, 6), MAX_RETRY_DELAY_MS);
}
