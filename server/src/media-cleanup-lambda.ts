import "./instrument";

import * as Sentry from "@sentry/aws-serverless";

import { configureEnv } from "@/config/env";
import { MediaCleanupService } from "@/services/media-cleanup.service";
import { ObjectStorageService } from "@/services/object-storage.service";
import { LoggerService } from "@/services/logger.service";
import { TaskQueueService } from "@/services/task-queue.service";
import { UrlUnfurlService } from "@/services/url-unfurl/url-unfurl.service";
import { VideoUploadService } from "@/services/video-upload.service";

configureEnv(process.env as Record<string, unknown>);

const cleanupService = new MediaCleanupService(new ObjectStorageService());
const maintenanceService = new UrlUnfurlService(
  new TaskQueueService(),
  new ObjectStorageService(),
  new LoggerService(),
);
const videoMaintenance = new VideoUploadService(new ObjectStorageService());

export const handler = Sentry.wrapHandler(async () => {
  const [cleanup, resourceMaintenance, staleVideos] = await Promise.all([
    cleanupService.processDueJobs(),
    maintenanceService.runMaintenance(),
    videoMaintenance.expireStale(),
  ]);
  const result = { cleanup, resourceMaintenance, staleVideos };
  console.info("media cleanup complete", result);
  return result;
});
