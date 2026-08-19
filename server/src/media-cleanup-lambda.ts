import "./instrument";

import * as Sentry from "@sentry/aws-serverless";

import { configureEnv } from "@/config/env";
import { MediaCleanupService } from "@/services/media-cleanup.service";
import { ObjectStorageService } from "@/services/object-storage.service";
import { LoggerService } from "@/services/logger.service";
import { TaskQueueService } from "@/services/task-queue.service";
import { UrlUnfurlService } from "@/services/url-unfurl/url-unfurl.service";

configureEnv(process.env as Record<string, unknown>);

const cleanupService = new MediaCleanupService(new ObjectStorageService());
const maintenanceService = new UrlUnfurlService(
  new TaskQueueService(),
  new ObjectStorageService(),
  new LoggerService(),
);

export const handler = Sentry.wrapHandler(async () => {
  const [cleanup, resourceMaintenance] = await Promise.all([
    cleanupService.processDueJobs(),
    maintenanceService.runMaintenance(),
  ]);
  const result = { cleanup, resourceMaintenance };
  console.info("media cleanup complete", result);
  return result;
});
