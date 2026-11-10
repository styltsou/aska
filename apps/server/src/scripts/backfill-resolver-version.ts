import "dotenv/config";

import { configureEnv } from "@/config/env";

configureEnv(process.env as Record<string, unknown>);

const { eq } = await import("drizzle-orm");
const { db } = await import("@/db");
const { externalResources, linkAssets } = await import("@/db/schema");
const { AppError, ErrorCode } = await import("@/lib/errors");
const { LoggerService } = await import("@/services/logger.service");
const { ObjectStorageService } =
  await import("@/services/object-storage.service");
const { TaskQueueService } = await import("@/services/task-queue.service");
const { expectedResolverForUrl, UrlUnfurlService } =
  await import("@/services/url-unfurl/url-unfurl.service");

const service = new UrlUnfurlService(
  new TaskQueueService(),
  new ObjectStorageService(),
  new LoggerService(),
);

const rows = await db
  .select({
    id: externalResources.id,
    organizationId: externalResources.organizationId,
    normalizedUrl: externalResources.normalizedUrl,
    resolverKey: externalResources.resolverKey,
    resolverVersion: externalResources.resolverVersion,
  })
  .from(externalResources);

const skipped: Record<string, number> = {};
const incrementSkipped = (reason: string) => {
  skipped[reason] = (skipped[reason] ?? 0) + 1;
};
let enqueued = 0;
let queueFailures = 0;

for (const row of rows) {
  const expected = expectedResolverForUrl(row.normalizedUrl);
  if (
    row.resolverKey === expected.key &&
    row.resolverVersion === expected.version
  ) {
    incrementSkipped("already_current");
    continue;
  }

  const reference = await db
    .select({ assetId: linkAssets.assetId })
    .from(linkAssets)
    .where(eq(linkAssets.resourceId, row.id))
    .limit(1);
  if (reference.length === 0) {
    incrementSkipped("unreferenced");
    continue;
  }

  try {
    const result = await service.refreshResource(row.organizationId, row.id);
    if (!result.queued) {
      incrementSkipped("active_attempt");
    } else if (result.enqueued) {
      enqueued += 1;
    } else {
      queueFailures += 1;
    }
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.RATE_LIMITED) {
      incrementSkipped("workspace_quota");
      continue;
    }
    if (
      error instanceof AppError &&
      error.code === ErrorCode.VALIDATION_ERROR
    ) {
      incrementSkipped("resolution_blocked");
      continue;
    }
    throw error;
  }
}

const remainingRows = await db
  .select({
    normalizedUrl: externalResources.normalizedUrl,
    resolverKey: externalResources.resolverKey,
    resolverVersion: externalResources.resolverVersion,
  })
  .from(externalResources);
const remainingDrift = remainingRows.filter((row) => {
  const expected = expectedResolverForUrl(row.normalizedUrl);
  return (
    row.resolverKey !== expected.key || row.resolverVersion !== expected.version
  );
}).length;

console.info(
  JSON.stringify(
    {
      scanned: rows.length,
      enqueued,
      queueFailures,
      skipped,
      remainingDriftAtScan: remainingDrift,
    },
    null,
    2,
  ),
);
