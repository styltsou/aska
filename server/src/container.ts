import { db } from "@/db";
import { AssetService } from "@/services/asset.service";
import { CollectionService } from "@/services/collection.service";
import { ColorSearchService } from "@/services/color-search.service";
import { HealthService } from "@/services/health.service";
import { ImageUploadService } from "@/services/image-upload.service";
import { ImageCropService } from "@/services/image-crop.service";
import { LoggerService } from "@/services/logger.service";
import { ObjectStorageService } from "@/services/object-storage.service";
import { NoteMentionService } from "@/services/note-mention.service";
import { PexelsService } from "@/services/pexels.service";
import { TaskQueueService } from "@/services/task-queue.service";
import { UrlUnfurlService } from "@/services/url-unfurl/url-unfurl.service";

const loggerService = new LoggerService();
const objectStorageService = new ObjectStorageService();
const pexelsService = new PexelsService();
const taskQueueService = new TaskQueueService();
const urlUnfurlService = new UrlUnfurlService(
  taskQueueService,
  objectStorageService,
  loggerService,
);

export const container = {
  db,
  healthService: new HealthService(),
  loggerService,
  objectStorageService,
  taskQueueService,
  urlUnfurlService,
  assetService: new AssetService({
    objectStorageService,
    resourceLifecycle: urlUnfurlService,
  }),
  collectionService: new CollectionService({
    objectStorageService,
    loggerService,
  }),
  pexelsService,
  imageUploadService: new ImageUploadService(
    objectStorageService,
    pexelsService,
  ),
  imageCropService: new ImageCropService(objectStorageService),
  colorSearchService: new ColorSearchService({
    objectStorageService,
    loggerService,
  }),
  noteMentionService: new NoteMentionService(),
};

export type Container = typeof container;
export type ContainerCradle = Container;
