import "./instrument";

import * as Sentry from "@sentry/aws-serverless";

import { configureEnv } from "@/config/env";
import { MediaCleanupService } from "@/services/media-cleanup.service";
import { ObjectStorageService } from "@/services/object-storage.service";

configureEnv(process.env as Record<string, unknown>);

const cleanupService = new MediaCleanupService(new ObjectStorageService());

export const handler = Sentry.wrapHandler(async () => {
  const result = await cleanupService.processDueJobs();
  console.info("media cleanup complete", result);
  return result;
});
